import { prisma, PrismaClient } from "@workspace/database";

export type BaseContext = {
  db: PrismaClient;
  walletAddress?: string;
};

export const createNextTRPCContext = async (opts: { headers: Headers }) => {
  return {
    db: prisma,
  } satisfies BaseContext;
};

export async function createContext(): Promise<BaseContext> {
  return {
    db: prisma,
  } satisfies BaseContext;
}
