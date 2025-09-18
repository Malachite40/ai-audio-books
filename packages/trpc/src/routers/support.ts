// TRPC router for support submissions
import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "../trpc";

export const supportRouter = createTRPCRouter({
  submit: publicProcedure
    .input(
      z.object({
        name: z.string().min(1, "Name is required"),
        description: z.string().min(1, "Description is required"),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await ctx.db.supportSubmission.create({
        data: {
          name: input.name,
          description: input.description,
        },
      });
      return { success: true };
    }),

  fetchAll: publicProcedure
    .input(
      z.object({
        page: z.number().min(1).default(1),
        pageSize: z.number().min(1).max(100).default(10),
      })
    )
    .query(async ({ input, ctx }) => {
      const { page, pageSize } = input;
      const [submissions, total] = await Promise.all([
        ctx.db.supportSubmission.findMany({
          orderBy: { createdAt: "desc" },
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        ctx.db.supportSubmission.count(),
      ]);
      return { submissions, total };
    }),
});
