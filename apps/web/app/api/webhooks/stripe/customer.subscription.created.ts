import { api } from "@/trpc/server";
import { prisma } from "@workspace/database";
import Stripe from "stripe";

// Basic clawback: if a referred user's first payment is refunded within 7 days, claw back 100k
export async function handleCustomerSubscriptionCreated(
  event: Stripe.CustomerSubscriptionCreatedEvent
) {
  const customerId =
    typeof event.data.object.customer === "string"
      ? event.data.object.customer
      : event.data.object.customer?.id;

  const user = await prisma.user.findFirst({
    where: { stripeCustomerId: customerId },
  });
  if (!user) return;

  await api.emails.subscribe({ email: user.email });
}
