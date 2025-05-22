import z from "zod";
import { createTRPCRouter, publicProcedure } from "../trpc";
import { audioChunkRouter } from "./audioChunk";

export const audioRouter = createTRPCRouter({
  chunks: audioChunkRouter,
  create: publicProcedure
    .input(
      z.object({
        text: z.string(),
        speakerId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const audioFile = await ctx.db.audioFile.create({
        data: {
          speakerId: input.speakerId,
        },
      });

      const chunkSize = 200;
      const sentences = input.text.match(/[^\.!\?]+[\.!\?]+/g) || [];
      const chunks: string[] = [];
      let bufferText = "";

      for (const sentence of sentences) {
        if ((bufferText + sentence).length > chunkSize && bufferText) {
          chunks.push(bufferText);
          bufferText = sentence;
        } else {
          bufferText += sentence;
        }
      }
      if (bufferText) chunks.push(bufferText);

      const responses = await Promise.all(
        chunks.map(async (chunk, index) => {
          return await ctx.db.audioChunk.create({
            data: {
              audioFileId: audioFile.id,
              text: chunk,
              sequence: index,
            },
          });
        })
      );

      // for (const chunk of responses) {
      //   const task = client.createTask("tasks.processAudioChunk");
      //   task.applyAsync([
      //     { id: chunk.id } satisfies z.infer<typeof audioChunkInput>,
      //   ]);
      //   return { audioFile };
      // }

      return { audioFile };
    }),
});
