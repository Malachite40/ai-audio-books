import { openai } from "@ai-sdk/openai";
import { TRPCError } from "@trpc/server";
import { generateObject } from "ai";
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
        durationMinutes: z
          .number({ invalid_type_error: "Enter minutes as a number" })
          .min(5)
          .max(120)
          .optional(),
        mode: z.enum(["copy", "ai"]),
        public: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      let text = input.text;
      let name = input.name;
      if (input.mode === "ai") {
        if (!input.durationMinutes) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Duration is required in AI mode.",
          });
        }

        if (ctx.credits.amount < (input.durationMinutes ?? 5) * 1000) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You do not have enough credits to perform this action.",
          });
        }

        const story = await generateStory({
          duration: input.durationMinutes,
          prompt: text,
        });

        name = story.object.title;
        text = story.object.story;
      }

      // Check credits
      if (text.length > ctx.credits.amount) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You do not have enough credits to perform this action.",
        });
      }

      const audioFile = await ctx.db.audioFile.create({
        data: {
          speakerId: input.speakerId,
          name: name,
          ownerId: ctx.user.id,
          public: input.public,
        },
      });

      const CHUNK_SIZE = input.chunkSize ?? 250;

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

      const sentences = splitIntoSentences(text);
      const chunkTexts = buildChunks(sentences, CHUNK_SIZE);
      const createdChunks = await Promise.all(
        chunkTexts
          .filter((c) => c.length > 0)
          .map((c, i) =>
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
        data: { amount: { decrement: text.length } },
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
          status: {
            notIn: ["PROCESSED"],
          },
        },
      });

      // Retry processing for each failed chunks
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

async function generateStory({
  duration,
  prompt,
}: {
  duration: number;
  prompt: string;
}) {
  return await generateObject({
    model: openai("gpt-4o-mini"),
    maxRetries: 3,
    mode: "json",
    schema: z.object({
      title: z.string().describe("Creative title of the story."),
      story: z.string().describe("The story text."),
    }),
    prompt: `
        You must return ONLY a JSON object matching the provided schema (no prose, no backticks, no Markdown).

        TASK
        Write an original, high-quality short story based on the user's premise.

        PREMISE
        ${prompt}

        DURATION & LENGTH
        Target spoken duration: ${duration} minutes.
        Assume 1 min ≈ 2000 characters; aim for ≈ ${Math.round(duration * 2000)} characters total (±10%). Keep pacing natural; avoid fluff.

        CONTENT & STYLE REQUIREMENTS
        - Title: evocative, ≤ 60 characters, no spoilers.
        - Story: plain text only; paragraphs separated by single blank lines; no chapter headings; no HTML/Markdown (asterisks for emphasis are allowed as cues).
        - Structure: hook in the first 2 sentences → rising tension → clear climax → satisfying resolution.
        - Voice: show, don’t tell; vivid sensory detail; active voice; varied sentence rhythm.
        - Scene/beat breaks for TTS: insert *** between beats roughly every 1–3k characters to create natural breath/cut points.
        - Rating: PG-13 by default unless the premise requests otherwise.
        - Originality: do NOT use copyrighted characters, settings, or lyrics unless supplied.
        - Language: American English. Match the TTS voice language to the story’s language; avoid mixing languages unless the premise requires it.

        TTS DELIVERY TIPS
        - Punctuation matters: use terminal punctuation; deploy ! for excitement; use … or — to indicate natural pauses.
        - Emphasis: surround stressed words with asterisks, e.g., We *need* a beach vacation (allowed as TTS cues, not Markdown styling).
        - Conversational feel (use sparingly and only when fitting): insert filler words (uh, um, well, like, you know) to mimic spontaneous speech.
        - Non-verbal cues: you may include tags like [sigh], [breathe], [clear_throat] to add realism.

        EDGE CASES
        - If the premise is empty, invent a compelling high-concept premise and proceed.

        OUTPUT FORMAT
        Return ONLY the JSON object with:
        - "title": string
        - "story": string
      `,
  });
}
