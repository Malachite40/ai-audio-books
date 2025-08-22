import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { TASK_NAMES } from "../queue";
import { client } from "../queue/client";
import {
  authenticatedProcedure,
  createTRPCRouter,
  publicProcedure,
} from "../trpc";
import { audioChunkInput, processAudioFileInput } from "./workers";

export const inworldRouter = createTRPCRouter({
  create: authenticatedProcedure
    .input(
      z.object({
        name: z.string().min(2, "Please enter a name.").max(100),
        text: z.string().min(1, "text is required"),
        speakerId: z.string(),
        chunkSize: z.number().int().positive().max(2000).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Check credits
      if (input.text.length > ctx.credits.amount) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You do not have enough credits to perform this action.",
        });
      }

      const audioFile = await ctx.db.audioFile.create({
        data: {
          speakerId: input.speakerId,
          name: input.name,
          ownerId: ctx.user.id,
        },
      });

      const CHUNK_SIZE = input.chunkSize ?? 500;

      const splitIntoSentences = (raw: string): string[] => {
        const text = raw.replace(/\s+/g, " ").trim();
        if (!text) return [];

        // Try Intl.Segmenter
        try {
          if (typeof Intl !== "undefined" && Intl.Segmenter) {
            const seg = new Intl.Segmenter("en", { granularity: "sentence" });
            const out: string[] = [];
            for (const { segment } of seg.segment(text)) {
              const s = String(segment).trim();
              if (s) out.push(s);
            }
            if (out.length) return out;
          }
        } catch {
          // fall through to regex
        }

        const rx = /[^.!?…]+(?:\.\.\.|[.!?]|…)+(?=\s+|$)|[^.!?…]+$/g;
        const matches = text.match(rx) ?? [];
        return matches.map((s) => s.trim());
      };

      const softWrap = (sentence: string, limit: number): string[] => {
        if (sentence.length <= limit) return [sentence];
        const words = sentence.split(/\s+/);
        const out: string[] = [];
        let buf = "";
        for (const w of words) {
          const next = buf ? `${buf} ${w}` : w;
          if (next.length > limit && buf) {
            out.push(buf);
            buf = w;
          } else {
            buf = next;
          }
        }
        if (buf) out.push(buf);
        return out;
      };

      const buildChunks = (sentences: string[], limit: number): string[] => {
        const chunks: string[] = [];
        let buf = "";

        const flush = () => {
          if (buf.trim()) chunks.push(buf.trim());
          buf = "";
        };

        for (const s0 of sentences) {
          const pieces = softWrap(s0, limit); // handle oversize sentence
          for (const s of pieces) {
            const candidate = buf ? `${buf} ${s}` : s;
            if (candidate.length > limit && buf) {
              flush();
              buf = s;
            } else {
              buf = candidate;
            }
          }
        }
        flush();
        return chunks;
      };

      const sentences = splitIntoSentences(input.text);
      const chunkTexts = buildChunks(sentences, CHUNK_SIZE);

      const createdChunks = await Promise.all(
        chunkTexts.map((c, i) =>
          ctx.db.audioChunk.create({
            data: {
              audioFileId: audioFile.id,
              text: c,
              sequence: i,
              paddingEndMs: 550,
            },
          })
        )
      );

      const task = client.createTask(TASK_NAMES.processAudioFile);
      task.applyAsync([
        { id: audioFile.id } satisfies z.infer<typeof processAudioFileInput>,
      ]);

      // deduct credit
      await ctx.db.credits.update({
        where: { userId: ctx.user.id },
        data: { amount: { decrement: input.text.length } },
      });

      return {
        audioFile,
        chunkCount: createdChunks.length,
      };
    }),
  retry: publicProcedure
    .input(z.object({ audioFileId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // fetch all failed audio chunks for audio-file
      const failedChunks = await ctx.db.audioChunk.findMany({
        where: {
          audioFileId: input.audioFileId,
          status: "ERROR",
        },
      });

      // Retry processing for each failed chunk
      await Promise.all(
        failedChunks.map((chunk) => {
          const task = client.createTask(
            TASK_NAMES.processAudioChunkWithInworld
          );
          return task.applyAsync([
            { id: chunk.id } satisfies z.infer<typeof audioChunkInput>,
          ]);
        })
      );
    }),
});
