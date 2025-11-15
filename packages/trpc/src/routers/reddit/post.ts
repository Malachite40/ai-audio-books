import z from "zod";
import { reddit } from "../../lib/reddit";
import { adminProcedure, createTRPCRouter } from "../../trpc";
export const postRouter = createTRPCRouter({
  getComments: adminProcedure
    .input(
      z.object({
        permalink: z.string().min(1),
        limit: z.number().min(1).max(500).optional(),
        depth: z.number().min(1).max(10).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const items = await reddit.getCommentsByPermalink(input.permalink, {
        limit: input.limit ?? 100,
        depth: input.depth ?? 5,
      });
      return { items };
    }),
});
