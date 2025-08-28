import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { env } from "../env";
import { stripe } from "../lib/stripe";
import { authenticatedProcedure, createTRPCRouter } from "../trpc";

export const stripeRouter = createTRPCRouter({
  createCheckoutSession: authenticatedProcedure
    .input(
      z.object({
        product: z.enum(["basic", "pro"]),
        cancel_url: z.string().url(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.subscription.plan !== "FREE") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You already have a subscription.",
        });
      }

      const session = await stripe.checkout.sessions.create({
        mode: "subscription", // Indicates that this is a subscription purchase
        customer: ctx.stripeCustomerId, // Your authenticated customer's Stripe ID
        line_items: [
          {
            price:
              input.product === "basic"
                ? env.STRIPE_BASIC_PLAN
                : env.STRIPE_PRO_PLAN,
            tax_rates: [env.TAX_RATE_ID],
            quantity: 1,
          },
        ],
        success_url: `${env.NEXT_PUBLIC_BASE_URL}/subscribe/success`,
        cancel_url: input.cancel_url,
      });

      if (!session.url) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create checkout session",
        });
      }

      return {
        url: session.url,
      };
    }),
  billingPortal: authenticatedProcedure
    .input(
      z.object({
        return_url: z.string().url(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const session = await stripe.billingPortal.sessions.create({
        customer: ctx.stripeCustomerId,
        return_url: input.return_url,
      });

      return {
        url: session.url,
      };
    }),
});
