import { z } from "zod";
import { env } from "../env";
import { stripe } from "../lib/stripe";
import {
  authenticatedProcedure,
  createTRPCRouter,
  publicProcedure,
} from "../trpc";

export type StripeCheckoutMetadata_Credits = {
  amount: number;
};

export const creditsRouter = createTRPCRouter({
  fetch: publicProcedure.query(async ({ ctx }) => {
    if (!ctx.user) {
      return { credits: null };
    }

    const credits = await ctx.db.credits.findFirst({
      where: {
        userId: ctx.user.id,
      },
    });
    return { credits };
  }),

  // Purchase procedure using Stripe Checkout
  purchase: authenticatedProcedure
    .input(
      z.object({
        quantity: z.number().min(1).max(10),
        success_url: z.string().url(),
        cancel_url: z.string().url(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Create a Stripe Checkout session using the customer's Stripe ID and the product price
      const session = await stripe.checkout.sessions.create({
        customer: ctx.stripeCustomerId,
        mode: "payment",
        line_items: [
          {
            price: env.ONE_M_CREDIT_PRICE,
            quantity: input.quantity,
          },
        ],
        // Replace with your actual URLs
        success_url: input.success_url,
        cancel_url: input.cancel_url,
        metadata: {
          credits: input.quantity * 1_000_000,
        },
      });

      return { url: session.url };
    }),
});
