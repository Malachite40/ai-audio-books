import {
  Credits,
  prisma,
  PrismaClient,
  Session,
  User,
} from "@workspace/database";
import { auth } from "./lib/auth";

export type BaseContext = {
  db: PrismaClient;
  user?: User;
  session?: Session;
  credits?: Credits;
};

export const createNextTRPCContext = async (opts: { headers: Headers }) => {
  const session = await auth.api.getSession({ headers: opts.headers });

  let credits: Credits | null = null;
  if (session) {
    // create credits if user exists
    credits = await prisma.credits.findUnique({
      where: {
        userId: session.user.id,
      },
    });

    if (!credits) {
      credits = await prisma.credits.create({
        data: {
          userId: session.user.id,
          amount: 5000,
        },
      });
    }
  }

  return {
    db: prisma,
    user: session?.user as User | undefined,
    session: session?.session as Session | undefined,
    credits: credits ?? undefined,
    ...opts,
  } satisfies BaseContext;
};

export async function createContext(): Promise<BaseContext> {
  return {
    db: prisma,
  } satisfies BaseContext;
}
