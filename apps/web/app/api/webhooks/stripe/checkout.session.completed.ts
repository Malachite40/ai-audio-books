// Node/TS (server)

import { env } from "@/env";
import { prisma } from "@workspace/database";
import { stripe } from "@workspace/trpc/server";
import Stripe from "stripe";

export async function handleCheckoutSessionCompleted(
  event: Stripe.CheckoutSessionCompletedEvent
) {
  const { payment_status, id, customer } = event.data.object;

  const paid = payment_status === "paid";

  if (!paid) {
    throw new Error("Payment not successful");
  }

  // Fetch products that were purchased
  const lineItems = await stripe.checkout.sessions.listLineItems(id, {
    expand: ["data.price.product"], // get product details in one go
  });

  for (const item of lineItems.data) {
    if (!item.price) continue;
    const priceId = item.price.id;
    const quantity = item.quantity ?? 0;
    const customerId = typeof customer === "string" ? customer : "";

    const user = await prisma.user.findFirstOrThrow({
      where: { stripeCustomerId: customerId },
    });

    switch (priceId) {
      case env.ONE_M_CREDIT_PRICE:
        await prisma.credits.upsert({
          where: { userId: user.id },
          update: { amount: { increment: quantity * 1_000_000 } },
          create: { userId: user.id, amount: quantity * 1_000_000 },
        });
        prisma.creditTransaction.create({
          data: {
            userId: user.id,
            amount: quantity * 1_000_000,
            description: "Purchased 1M credits",
            reason: "top-up",
          },
        });
        break;
    }
  }
}
