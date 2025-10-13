import { env } from "@/env";
import { api } from "@/trpc/server";
import { prisma, SubscriptionPlans } from "@workspace/database";
import Stripe from "stripe";

export async function handleInvoicePaid(event: Stripe.InvoicePaidEvent) {
  const { customer, lines, id, parent } = event.data.object;

  // Validate customer ID
  const customerId = typeof customer === "string" ? customer : customer?.id;
  if (!customerId) {
    throw new Error("Missing customer ID");
  }

  // Get pricing from the last line item
  const lastLineItem = lines.data[lines.data.length - 1];
  if (!lastLineItem) {
    console.error(`No line items found for invoice ${id}`);
    return;
  }
  const pricing = lastLineItem.pricing;
  if (!pricing) {
    console.error(`No pricing found for invoice ${id}`);
    return;
  }
  const priceId = pricing.price_details?.price;
  if (!priceId) {
    console.error(`No price ID found for invoice ${id}`);
    return;
  }

  // Determine subscription plan from price ID
  let plan: SubscriptionPlans = "FREE";
  switch (priceId) {
    case env.STRIPE_BASIC_PLAN:
      plan = "BASIC";
      break;
    case env.STRIPE_PRO_PLAN:
      plan = "PRO";
      break;
    default:
      console.error(`Unknown price id ${priceId}`);
      return;
  }

  // Validate invoice parent and subscription details
  if (!parent) {
    console.error(`No parent found for invoice ${id}`);
    return;
  }
  if (!parent.subscription_details) {
    console.error(`No subscription details found for invoice ${id}`);
    return;
  }

  // Extract subscription ID
  const subscriptionDetail = parent.subscription_details;
  const subscriptionId =
    typeof subscriptionDetail.subscription === "string"
      ? subscriptionDetail.subscription
      : subscriptionDetail.subscription?.id;
  if (!subscriptionId) {
    console.error(`No subscription ID found for invoice ${id}`);
    return;
  }

  // Find the user associated with the Stripe customer ID
  const user = await prisma.user.findFirst({
    where: { stripeCustomerId: customerId },
  });
  if (!user) {
    throw new Error("User not found");
  }

  const planData = {
    FREE: { credits: 0 },
    BASIC: { credits: 1_000_000 },
    PRO: { credits: 5_000_000 },
  } as const;

  // Upsert subscription record
  await prisma.subscriptions.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      plan,
      stripeSubscriptionId: subscriptionId,
    },
    update: {
      plan,
      stripeSubscriptionId: subscriptionId,
    },
  });

  // Upsert credits record
  await prisma.credits.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      amount: planData[plan].credits,
    },
    update: {
      amount: {
        increment: planData[plan].credits,
      },
    },
  });

  await prisma.creditTransaction.create({
    data: {
      userId: user.id,
      amount: planData[plan].credits,
      description: `Subscription payment - ${plan} plan`,
      reason: "subscription_payment",
    },
  });

  // Referral award on first payment (idempotent server-side)
  try {
    await api.referrals.awardOnFirstPayment({ referredUserId: user.id });
  } catch (e) {
    console.error("Failed to award referral bonus:", e);
  }
}
