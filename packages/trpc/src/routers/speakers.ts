import z from "zod";
import { createTRPCRouter, publicProcedure } from "../trpc";

export const speakersRouter = createTRPCRouter({
  upsert: publicProcedure
    .input(
      z.object({
        id: z.string().uuid().optional(),
        name: z.string(),
        order: z.number().min(0).optional(),
        exampleAudio: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { name } = input;

      await ctx.db.speaker.upsert({
        where: { id: input.id },
        create: {
          name,
          order: input.order,
          exampleAudio: input.exampleAudio,
        },
        update: {
          name,
          order: input.order,
          exampleAudio: input.exampleAudio,
        },
      });

      return {};
    }),
  fetchAll: publicProcedure.query(async ({ ctx }) => {
    const speakers = await ctx.db.speaker.findMany({
      orderBy: { order: "asc" },
    });
    return { speakers };
  }),

  remove: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      await ctx.db.speaker.delete({
        where: { id: input.id },
      });
      return { success: true };
    }),
});
