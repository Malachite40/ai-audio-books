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
      const { id, name, order, exampleAudio } = input;
      if (id) {
        await ctx.db.speaker.upsert({
          where: { id },
          create: { name, order, exampleAudio },
          update: { name, order, exampleAudio },
        });
      } else {
        await ctx.db.speaker.create({
          data: { name, order, exampleAudio },
        });
      }
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
