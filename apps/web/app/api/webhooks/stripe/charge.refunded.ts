import { prisma } from "@workspace/database";
import Stripe from "stripe";

// Basic clawback: if a referred user's first payment is refunded within 7 days, claw back 100k
export async function handleChargeRefunded(event: Stripe.ChargeRefundedEvent) {
  const charge = event.data.object;
  const customerId =
    typeof charge.customer === "string" ? charge.customer : charge.customer?.id;
  if (!customerId) return;

  const user = await prisma.user.findFirst({
    where: { stripeCustomerId: customerId },
  });
  if (!user) return;

  // Check if this user had a referral PAID event within last 7 days
  const paidEvent = await prisma.referralEvent.findFirst({
    where: { referredUserId: user.id, type: "PAID" },
    orderBy: { createdAt: "asc" },
  });
  if (!paidEvent) return;

  const now = new Date();
  const diffMs = now.getTime() - paidEvent.createdAt.getTime();
  const within7Days = diffMs <= 7 * 24 * 60 * 60 * 1000;
  if (!within7Days) return;

  // Clawback: create negative credit transaction and decrement Credits
  const link = await prisma.referralLink.findUnique({
    where: { id: paidEvent.referralLinkId },
  });
  if (!link) return;

  await prisma.$transaction(async (tx) => {
    await tx.creditTransaction.create({
      data: {
        userId: link.userId,
        amount: -100_000,
        reason: "referral_clawback",
        description: `Clawback for refund of referred user's first payment - ${user.email} (userId: ${user.id})`,
      },
    });
    await tx.credits.upsert({
      where: { userId: link.userId },
      create: { userId: link.userId, amount: 0 },
      update: { amount: { decrement: 100_000 } },
    });
  });
}
