import z from "zod";
import { client } from "../queue/client";
import { TASK_NAMES } from "../queue/index";
import { createTRPCRouter, queueProcedure } from "../trpc";

// Inputs
export const testAudioChunkInput = z.object({ id: z.string().uuid() });
export const testConcatAudioFileInput = z.object({ id: z.string().uuid() });

const PLACEHOLDER_URL =
  "https://instantaudio.online/audio/d67cfd0a-ba84-498c-89cb-9146c3e0b413.mp3";

// For Celery task registration compatibility
export const concatTestAudioFile = queueProcedure
  .input(testConcatAudioFileInput)
  .mutation(async ({ ctx, input }) => {
    // Simulate concat processing
    await new Promise((r) => setTimeout(r, 2000));
    // Update audio file status and URL
    await ctx.db.audioFile.update({
      where: { id: input.id },
      data: {
        status: "PROCESSED",
      },
    });
    return { url: PLACEHOLDER_URL };
  });

export const testWorkersRouter = createTRPCRouter({
  processAudioChunk: queueProcedure
    .input(testAudioChunkInput)
    .mutation(async ({ ctx, input }) => {
      // Simulate processing
      await new Promise((r) => setTimeout(r, 2000));
      // Update chunk status and URL
      await ctx.db.audioChunk.update({
        where: { id: input.id },
        data: {
          status: "PROCESSED",
          url: PLACEHOLDER_URL,
          durationMs: 10000, // arbitrary duration
        },
      });

      // Check if all chunks for this audio file are processed
      const chunk = await ctx.db.audioChunk.findUnique({
        where: { id: input.id },
      });
      if (!chunk) return { url: PLACEHOLDER_URL };
      const allChunks = await ctx.db.audioChunk.findMany({
        where: { audioFileId: chunk.audioFileId },
        select: { status: true },
      });
      const allProcessed =
        allChunks.length > 0 &&
        allChunks.every((c) => c.status === "PROCESSED");
      if (allProcessed) {
        // Queue concat test procedure
        const task = client.createTask(TASK_NAMES.test.concatTestAudioFile);
        await task.applyAsync([{ id: chunk.audioFileId }]);
      }
      return { url: PLACEHOLDER_URL };
    }),

  concatTestAudioFile,
  processTestAudioFile: queueProcedure
    .input(testConcatAudioFileInput)
    .mutation(async ({ ctx, input }) => {
      await ctx.db.audioFile.update({
        where: { id: input.id },
        data: { status: "PROCESSING" },
      });

      const chunks = await ctx.db.audioChunk.findMany({
        where: { audioFileId: input.id },
        orderBy: { sequence: "asc" },
      });

      const BATCH_SIZE = 8;
      for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
        const batch = chunks.slice(i, i + BATCH_SIZE);
        await Promise.all(
          batch.map((chunk) => {
            const task = client.createTask(
              TASK_NAMES.test.processTestAudioChunk
            );
            return task.applyAsync([{ id: chunk.id }]);
          })
        );
        if (i + BATCH_SIZE < chunks.length) {
          await new Promise((r) => setTimeout(r, 5000));
        }
      }
      return {};
    }),
});
