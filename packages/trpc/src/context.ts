import { prisma, PrismaClient } from "@workspace/database";

export type BaseContext = {
  db: PrismaClient;
  walletAddress?: string;
};

export const createNextTRPCContext = async (opts: { headers: Headers }) => {
  return {
    db: prisma,
    walletAddress: opts.headers.get("x-wallet-address") as string | undefined,
  } satisfies BaseContext;
};
