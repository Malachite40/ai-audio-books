import { z } from "zod";
import { env } from "../env";
import type { Prisma } from "@workspace/database";
import { stripe } from "../lib/stripe";
import {
  authenticatedProcedure,
  createTRPCRouter,
  publicProcedure,
  adminProcedure,
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

  // Admin: list all credit transactions (paginated)
  listTransactions: adminProcedure
    .input(
      z.object({
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(100).default(20),
        search: z.string().max(200).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { page, pageSize, search } = input;
      const where: Prisma.CreditTransactionWhereInput | undefined = search
        ? {
            OR: [
              {
                description: {
                  contains: search,
                  mode: "insensitive" as const,
                },
              },
              {
                reason: {
                  contains: search,
                  mode: "insensitive" as const,
                },
              },
              {
                user: {
                  email: { contains: search, mode: "insensitive" as const },
                },
              },
            ],
          }
        : undefined;

      const [total, items] = await Promise.all([
        ctx.db.creditTransaction.count({ where }),
        ctx.db.creditTransaction.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip: (page - 1) * pageSize,
          take: pageSize,
          include: {
            user: { select: { id: true, email: true, name: true } },
          },
        }),
      ]);

      return {
        total,
        page,
        pageSize,
        items: items.map((t) => ({
          id: t.id,
          userId: t.userId,
          amount: t.amount,
          reason: t.reason,
          description: t.description,
          createdAt: t.createdAt,
          user: t.user,
        })),
      };
    }),
});
