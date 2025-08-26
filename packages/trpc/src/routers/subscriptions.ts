import { createTRPCRouter, publicProcedure } from "../trpc";

export const subscriptionsRouter = createTRPCRouter({
  self: publicProcedure.query(async ({ input, ctx }) => {
    if (!ctx.subscription) return { subscription: null };
    return { subscription: ctx.subscription };
  }),
});
