import { createTRPCRouter, publicProcedure } from "../trpc";

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
});
