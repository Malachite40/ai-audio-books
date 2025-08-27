import { TRPCError } from "@trpc/server";
import {
  Credits,
  prisma,
  PrismaClient,
  Session,
  Subscriptions,
  User,
} from "@workspace/database";
import { auth } from "./lib/auth";
import { CreateStripeAccount } from "./lib/stripe/create-customer";

export type BaseContext = {
  db: PrismaClient;
  user?: User;
  session?: Session;
  credits?: Credits;
  subscription?: Subscriptions;
  stripeCustomerId?: string;
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
    }

    if (!user.stripeCustomerId) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Failed to find stripe customer id.",
      });
    }
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

export async function createContext(): Promise<BaseContext> {
  return {
    db: prisma,
  } satisfies BaseContext;
}
