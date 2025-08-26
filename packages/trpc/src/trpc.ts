import { initTRPC, TRPCError } from "@trpc/server";
import SuperJSON from "superjson";
import { BaseContext } from "./context";

// type Context = Awaited<ReturnType<typeof BaseContext>>;

export const t = initTRPC.context<BaseContext>().create({
  transformer: SuperJSON,
});

export const createCallerFactory = t.createCallerFactory;

export const createTRPCRouter = t.router;

async function assertAuthenticated(ctx: BaseContext) {
  if (!ctx.user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "You must be logged in to access this resource.",
    });
  }
  if (!ctx.session) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Your session is invalid. Please log in again.",
    });
  }

  return {
    user: ctx.user,
    session: ctx.session,
  };
}

const enforceUserIsAuthed = t.middleware(async ({ ctx, next }) => {
  const { user, session } = await assertAuthenticated(ctx);

  if (!ctx.credits) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Credits not found.",
    });
  }

  if (!ctx.user?.stripeCustomerId) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Stripe customer ID not found.",
    });
  }

  if (!ctx.stripeCustomerId) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Stripe customer ID not found.",
    });
  }

  if (!ctx.subscription) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Subscription not found.",
    });
  }

  return next({
    ctx: {
      ...ctx,
      user,
      session,
      credits: ctx.credits,
      subscription: ctx.subscription,
      stripeCustomerId: ctx.stripeCustomerId,
    },
  });
});

const enforceAdmin = t.middleware(async ({ ctx, next }) => {
  const { user, session } = await assertAuthenticated(ctx);
  if (user.role !== "admin") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You do not have permission to access this resource.",
    });
  }

  return next({
    ctx: {
      ...ctx,
      user: user,
      session: session,
    },
  });
});

export const publicProcedure = t.procedure;
export const authenticatedProcedure = t.procedure.use(enforceUserIsAuthed);
export const adminProcedure = t.procedure.use(enforceAdmin);
