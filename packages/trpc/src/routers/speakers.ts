import z from "zod";
import { createTRPCRouter, publicProcedure } from "../trpc";

export const speakersRouter = createTRPCRouter({
  create: publicProcedure
    .input(
      z.object({
        name: z.string(),
        speakerEmbedding: z.array(z.number()),
        gptCondLatent: z.array(z.array(z.number())),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { name, speakerEmbedding, gptCondLatent } = input;

      await ctx.db.speaker.create({
        data: {
          name,
          gptCondLatent: gptCondLatent,
          speakerEmbedding: speakerEmbedding,
        },
      });

      return {};
    }),
  getAll: publicProcedure.query(async ({ ctx }) => {
    const speakers = await ctx.db.speaker.findMany({
      select: {
        name: true,
        id: true,
        image: true,
      },
    });
    return { speakers };
  }),
});
