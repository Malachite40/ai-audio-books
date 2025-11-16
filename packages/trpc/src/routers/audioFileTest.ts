import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { TASK_NAMES } from "../queue";
import { enqueueTask } from "../queue/enqueue";
import { authenticatedProcedure, createTRPCRouter } from "../trpc";
import { processAudioFileInput } from "./workers";

const ID = "d67cfd0a-ba84-498c-89cb-9146c3e0b413";

export const audioFileTestCreateInput = z.object({
  name: z.string().min(2, "Please enter a name.").max(100),
  text: z.string().min(1, "text is required"),
  speakerId: z.string(),
  chunkSize: z.number().int().positive().max(2000).optional(),
  durationMinutes: z
    .number({ invalid_type_error: "Enter minutes as a number" })
    .min(5)
    .max(120)
    .optional(),
  mode: z.enum(["copy", "ai"]),
  public: z.boolean(),
});

export const audioFileTestRouter = createTRPCRouter({
  create: authenticatedProcedure
    .input(audioFileTestCreateInput)
    .mutation(async ({ ctx, input }) => {
      // Mock credit checks
      if (
        input.durationMinutes &&
        ctx.credits.amount < (input.durationMinutes ?? 5) * 1000
      ) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You do not have enough credits to perform this action.",
        });
      }
      if (input.text.length > ctx.credits.amount) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You do not have enough credits to perform this action.",
        });
      }

      // delete test audio file if exists
      const existing = await ctx.db.audioFile.findFirst({
        where: { id: ID },
      });
      if (existing) {
        await ctx.db.audioFile.delete({
          where: { id: existing.id },
        });
      }

      //   delete chunks if exist
      await ctx.db.audioChunk.deleteMany({
        where: { audioFileId: ID },
      });

      // Always create a new audio file (mock real flow)
      const audioFile = await ctx.db.audioFile.create({
        data: {
          id: ID, // fixed ID for testing
          speakerId: input.speakerId,
          name: input.name,
          ownerId: ctx.user.id,
          text: input.text,
          public: input.public,
          status: "PROCESSING",
          durationMs: input.durationMinutes
            ? input.durationMinutes * 60 * 1000
            : undefined,
        },
      });

      // Chunking logic (same as real)
      const text = input.text.replace(/\s+/g, " ").trim();
      const sentences = text.split(/(?<=[.!?…])\s+/);
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
          const pieces = softWrap(s0, limit);
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
      const chunkTexts = buildChunks(sentences, input.chunkSize ?? 1000);
      const filtered = chunkTexts.filter((c) => c.length > 0);
      for (let i = 0; i < filtered.length; i++) {
        await ctx.db.audioChunk.create({
          data: {
            audioFileId: audioFile.id,
            text: String(filtered[i]),
            sequence: i,
            paddingEndMs: 550,
          },
        });
      }

      await enqueueTask(TASK_NAMES.test.processTestAudioFile, {
        id: audioFile.id,
      });
      return { audioFile };
    }),
});
