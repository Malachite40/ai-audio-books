import { initTRPC, TRPCError } from "@trpc/server";
import SuperJSON from "superjson";
import { BaseContext } from "./context";

// type Context = Awaited<ReturnType<typeof BaseContext>>;

export const t = initTRPC.context<BaseContext>().create({
  transformer: SuperJSON,
});

export const createCallerFactory = t.createCallerFactory;

export const createTRPCRouter = t.router;

const enforceUserIsAuthed = t.middleware(async ({ ctx, next, path }) => {
  if (!ctx.walletAddress) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "You must have a wallet address.",
    });
  }

  return next({
    ctx: {
      walletAddress: ctx.walletAddress, // re-assign the wallet address for strict typing
    },
  });
});

export const publicProcedure = t.procedure;
export const authenticatedProcedure = t.procedure.use(enforceUserIsAuthed);
