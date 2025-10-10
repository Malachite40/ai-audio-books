import { TRPCError } from "@trpc/server";
import { ReferralBonusEmail } from "@workspace/transactional";
import crypto from "crypto";
import { z } from "zod";
import { env } from "../env";
import { resend } from "../lib/resend";
import {
  authenticatedProcedure,
  createTRPCRouter,
  publicProcedure,
} from "../trpc";

const REFERRAL_BONUS = 100_000;

function generateCode(length = 10) {
  // URL-safe random code
  return crypto
    .randomBytes(Math.ceil((length * 3) / 4))
    .toString("base64url")
    .slice(0, length);
}

export const referralsRouter = createTRPCRouter({
  getOrCreateMyLink: authenticatedProcedure.query(async ({ ctx }) => {
    let link = await ctx.db.referralLink.findUnique({
      where: { userId: ctx.user.id },
    });
    if (!link) {
      link = await ctx.db.referralLink.create({
        data: { userId: ctx.user.id, code: generateCode(10) },
      });
    }
    const base = env.NEXT_PUBLIC_BASE_URL;
    const url = new URL(`/r/${link.code}`, base);

    const totalBonusCredits = await ctx.db.creditTransaction.aggregate({
      where: { userId: ctx.user.id, reason: "referral_bonus" },
      _sum: { amount: true },
    });

    return {
      code: link.code,
      url: url.toString(),
      stats: {
        clicks: link.clicks,
        signups: link.signupCount,
        paid: link.paidCount,
        totalBonusCredits: totalBonusCredits._sum.amount ?? 0,
      },
    };
  }),

  getMyStats: authenticatedProcedure.query(async ({ ctx }) => {
    const link = await ctx.db.referralLink.findUnique({
      where: { userId: ctx.user.id },
    });
    if (!link)
      return {
        clicks: 0,
        signups: 0,
        paid: 0,
        signupRate: 0,
        paidRate: 0,
        totalBonusCredits: 0,
      };
    const totalBonusCredits = await ctx.db.creditTransaction.aggregate({
      where: { userId: ctx.user.id, reason: "referral_bonus" },
      _sum: { amount: true },
    });
    const { clicks, signupCount: signups, paidCount: paid } = link;
    return {
      clicks,
      signups,
      paid,
      signupRate: clicks ? signups / clicks : 0,
      paidRate: signups ? paid / signups : 0,
      totalBonusCredits: totalBonusCredits._sum.amount ?? 0,
    };
  }),

  recordClick: publicProcedure
    .input(
      z.object({
        code: z.string(),
        ipHash: z.string().optional(),
        ua: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const link = await ctx.db.referralLink.findUnique({
        where: { code: input.code },
      });
      if (!link) return { ok: true };
      await ctx.db.$transaction([
        ctx.db.referralEvent.create({
          data: {
            referralLinkId: link.id,
            type: "CLICK",
            ipHash: input.ipHash,
            userAgent: input.ua,
          },
        }),
        ctx.db.referralLink.update({
          where: { id: link.id },
          data: { clicks: { increment: 1 } },
        }),
      ]);
      return { ok: true };
    }),

  recordSignup: publicProcedure
    .input(z.object({ code: z.string(), referredUserId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const link = await ctx.db.referralLink.findUnique({
        where: { code: input.code },
      });
      if (!link || link.userId === input.referredUserId) return { ok: true };
      const exists = await ctx.db.referralEvent.findFirst({
        where: { referredUserId: input.referredUserId, type: "SIGNUP" },
      });
      if (exists) return { ok: true };
      await ctx.db.$transaction([
        ctx.db.referralEvent.create({
          data: {
            referralLinkId: link.id,
            type: "SIGNUP",
            referredUserId: input.referredUserId,
          },
        }),
        ctx.db.referralLink.update({
          where: { id: link.id },
          data: { signupCount: { increment: 1 } },
        }),
      ]);
      return { ok: true };
    }),

  awardOnFirstPayment: publicProcedure
    .input(z.object({ referredUserId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.db.user.findUnique({
        where: { id: input.referredUserId },
      });

      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Referred user not found",
        });
      }

      const signup = await ctx.db.referralEvent.findFirst({
        where: { referredUserId: input.referredUserId, type: "SIGNUP" },
        include: {
          referralLink: {
            include: {
              user: true,
            },
          },
        },
      });
      if (!signup) return { ok: true };
      const hasPaid = await ctx.db.referralEvent.findFirst({
        where: { referredUserId: input.referredUserId, type: "PAID" },
      });
      if (hasPaid) return { ok: true };

      await ctx.db.$transaction(async (tx) => {
        await tx.referralEvent.create({
          data: {
            referralLinkId: signup.referralLinkId,
            type: "PAID",
            referredUserId: input.referredUserId,
          },
        });
        await tx.referralLink.update({
          where: { id: signup.referralLinkId },
          data: { paidCount: { increment: 1 } },
        });
        await tx.creditTransaction.create({
          data: {
            userId: signup.referralLink.userId,
            amount: REFERRAL_BONUS,
            reason: "referral_bonus",
            description: `Referral bonus for ${user.email} (userId: ${user.id}) first payment. Referred by ${signup.referralLink.user.email}`,
          },
        });
        // Also increase live Credits balance for referrer
        await tx.credits.upsert({
          where: { userId: signup.referralLink.userId },
          create: {
            userId: signup.referralLink.userId,
            amount: REFERRAL_BONUS,
          },
          update: { amount: { increment: REFERRAL_BONUS } },
        });
      });

      // Optional: send email notification
      try {
        const referrer = await ctx.db.user.findUnique({
          where: { id: signup.referralLink.userId },
        });
        referrer?.email &&
          (await resend.emails.send({
            from: "Instant Audio Online <support@instantaudio.online>",
            to: [referrer.email],
            subject: "You earned 100,000 credits 🎉",
            react: ReferralBonusEmail({
              referredEmail: user.email,
              bonus: REFERRAL_BONUS,
              total: undefined,
            }),
          }));
      } catch (_) {}

      return { ok: true };
    }),
});
