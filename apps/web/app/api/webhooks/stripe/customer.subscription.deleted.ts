import { prisma } from "@workspace/database";
import Stripe from "stripe";

export async function handleCustomerSubscriptionDelete(
  event: Stripe.CustomerSubscriptionDeletedEvent
) {
  const { id } = event.data.object;
  await prisma.subscriptions.updateMany({
    where: {
      stripeSubscriptionId: id,
    },
    data: {
      plan: "FREE",
      stripeSubscriptionId: null,
    },
  });
}
