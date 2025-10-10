import { TRPCError } from "@trpc/server";
import {
  Credits,
  prisma,
  PrismaClient,
  Session,
  Subscriptions,
  User,
} from "@workspace/database";
import { WelcomeEmail } from "@workspace/transactional";
import { auth } from "./lib/auth";
import { resend } from "./lib/resend";
import { CreateStripeAccount } from "./lib/stripe/create-customer";
import { env } from "./env";
import crypto from "crypto";

export type BaseContext = {
  db: PrismaClient;
  user?: User;
  session?: Session;
  credits?: Credits;
  subscription?: Subscriptions;
  stripeCustomerId?: string;
};

export type QueueContext = BaseContext & {
  apiKey: string;
};

export const createNextTRPCContext = async (opts: { headers: Headers }) => {
  const session = await auth.api.getSession({ headers: opts.headers });

  let credits: Credits | null = null;
  let subscription: Subscriptions | null = null;
  let user: User | null = null;
  let stripeCustomerId: string | null = null;

  if (session) {
    user = await prisma.user.findUniqueOrThrow({
      where: {
        id: session.user.id,
      },
    });
    stripeCustomerId = user.stripeCustomerId;
    // create credits if user exists
    credits = await prisma.credits.findUnique({
      where: {
        userId: user.id,
      },
    });

    if (!credits) {
      credits = await prisma.credits.create({
        data: {
          userId: user.id,
          amount: 20_000,
        },
      });
    }

    subscription = await prisma.subscriptions.findUnique({
      where: {
        userId: user.id,
      },
    });

    if (!subscription) {
      subscription = await prisma.subscriptions.create({
        data: {
          userId: user.id,
          plan: "FREE",
        },
      });
    }

    if (!user.stripeCustomerId) {
      const { updatedUser, stripeCustomerAccount } = await CreateStripeAccount({
        userId: user.id,
        email: user.email,
      });
      stripeCustomerId = stripeCustomerAccount.id;
      user = updatedUser;

      await resend.emails.send({
        from: "Instant Audio Online <support@instantaudio.online>",
        to: [updatedUser.email],
        subject: "Welcome to Instant Audio Online!",
        react: WelcomeEmail({}),
      });
    }

    if (!user.stripeCustomerId) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Failed to find stripe customer id.",
      });
    }

    // Attribution: if referral cookie present, record signup once (idempotent)
    try {
      const cookies = opts.headers.get("cookie") || "";
      const match = cookies.match(/(?:^|;\s*)ref=([^;]+)/);
      if (match && user) {
        const raw = match[1] ?? "";
        if (raw) {
          const normalizeBase64Url = (s: string) => {
            let b64 = s.replace(/-/g, "+").replace(/_/g, "/");
            const pad = b64.length % 4;
            if (pad) b64 = b64 + "=".repeat(4 - pad);
            return b64;
          };
          const decodedStr = Buffer.from(normalizeBase64Url(raw), "base64").toString("utf8");
          const decoded = JSON.parse(decodedStr) as { code?: string; ts?: number; sig?: string };
          if (decoded?.code && typeof decoded.ts === "number" && decoded.sig) {
            const payload = JSON.stringify({ code: decoded.code, ts: decoded.ts });
            const sig = crypto.createHmac("sha256", env.REFERRAL_COOKIE_SECRET).update(payload).digest("hex");
            if (sig === decoded.sig) {
              const link = await prisma.referralLink.findUnique({ where: { code: decoded.code } });
              if (link && link.userId !== user.id) {
                const exists = await prisma.referralEvent.findFirst({ where: { referredUserId: user.id, type: "SIGNUP" } });
                if (!exists) {
                  await prisma.$transaction([
                    prisma.referralEvent.create({ data: { referralLinkId: link.id, type: "SIGNUP", referredUserId: user.id } }),
                    prisma.referralLink.update({ where: { id: link.id }, data: { signupCount: { increment: 1 } } }),
                  ]);
                }
              }
            }
          }
        }
      }
    } catch {}
  }

  return {
    db: prisma,
    user: user ?? undefined,
    session: session?.session as Session | undefined,
    credits: credits ?? undefined,
    subscription: subscription ?? undefined,
    stripeCustomerId: stripeCustomerId ?? undefined,
    ...opts,
  } satisfies BaseContext;
};

export async function createQueueContext({
  apiKey,
}: {
  apiKey: string;
}): Promise<QueueContext> {
  return {
    apiKey,
    db: prisma,
  } satisfies QueueContext;
}

export async function createContext(): Promise<BaseContext> {
  return {
    db: prisma,
  } satisfies BaseContext;
}
