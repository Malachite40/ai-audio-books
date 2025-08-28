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
      // Save to database using Prisma
      await ctx.db.supportSubmission.create({
        data: {
          name: input.name,
          description: input.description,
        },
      });
      return { success: true };
    }),
});
