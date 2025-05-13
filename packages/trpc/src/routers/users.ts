import z from "zod";
import { createTRPCRouter, publicProcedure } from "../trpc";

export const usersRouter = createTRPCRouter({
  helloWorld: publicProcedure
    .input(z.object({ text: z.string().nullish() }).nullish())
    .query(({ input }) => {
      return {
        greeting: `Hello ${input?.text ?? "world!"}`,
      };
    }),
  fetchAll: publicProcedure
    .input(z.object({ text: z.string().nullish() }).nullish())
    .query(async ({ input, ctx }) => {
      const users = await ctx.db.user.findMany({});
      return {
        users,
      };
    }),
});
