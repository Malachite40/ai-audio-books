import z from "zod";
import { Languages } from "../lib/constants";
import { TASK_NAMES } from "../queue";
import { client } from "../queue/client";
import { adminProcedure, createTRPCRouter, publicProcedure } from "../trpc";
import { createAudioFileChunksInput } from "./workers";
export const speakersRouter = createTRPCRouter({
  upsert: publicProcedure
    .input(
      z.object({
        id: z.string().uuid().optional(),
        name: z.string(),
        displayName: z.string().min(1, "Please enter a speaker name."),
        language: z.enum(Languages),
        order: z.number().min(0).optional(),
        exampleAudio: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { id, name, order, exampleAudio, displayName, language } = input;
      if (id) {
        await ctx.db.speaker.upsert({
          where: { id },
          create: { name, order, exampleAudio, displayName, language },
          update: { name, order, exampleAudio, displayName, language },
        });
      } else {
        await ctx.db.speaker.create({
          data: { name, order, exampleAudio, displayName, language },
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

  // Admin-only: Create a public sample audio for a speaker and set exampleAudio
  createExample: adminProcedure
    .input(
      z.object({
        speakerId: z.string().uuid(),
        text: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const speaker = await ctx.db.speaker.findUnique({
        where: { id: input.speakerId },
      });
      if (!speaker) {
        throw new Error("Speaker not found");
      }

      const defaultSentence = `Hi, this is a short sample of ${speaker.displayName}'s voice.`;

      // Create ownerless, public audio file (so it’s shareable without login)
      const audioFile = await ctx.db.audioFile.create({
        data: {
          speakerId: speaker.id,
          name: `Sample — ${speaker.displayName || speaker.name}`,
          ownerId: null,
          text: input.text?.trim().length ? input.text : defaultSentence,
          public: true,
        },
      });

      // Queue chunk creation/processing
      const task = client.createTask(TASK_NAMES.createAudioFileChunks);
      await task.applyAsync([
        { audioFileId: audioFile.id, chunkSize: 300 } as z.infer<
          typeof createAudioFileChunksInput
        >,
      ]);

      // Point exampleAudio to the final MP3 URL immediately
      const url = `https://instantaudio.online/audio/${audioFile.id}.mp3`;
      await ctx.db.speaker.update({
        where: { id: speaker.id },
        data: { exampleAudio: url },
      });

      return { audioFileId: audioFile.id, url };
    }),
});
