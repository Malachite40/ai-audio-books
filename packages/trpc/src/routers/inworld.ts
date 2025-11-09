import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { sectionType } from "../lib/utils/chunking";
import { TASK_NAMES } from "../queue";
import { client } from "../queue/client";
import { authenticatedProcedure, createTRPCRouter } from "../trpc";
import {
  audioChunkInput,
  createAudioFileChunksFromChaptersInput,
  createAudioFileChunksInput,
} from "./workers";
import { generateStoryInput } from "./workers/ai";

export const inworldRouter = createTRPCRouter({
  createFromCopy: authenticatedProcedure
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
        public: z.boolean(),
        includeTitle: z.boolean().optional().default(true),
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
          text: input.text,
          public: input.public,
        },
      });

      const task = client.createTask(TASK_NAMES.createAudioFileChunks);
      task.applyAsync([
        {
          audioFileId: audioFile.id,
          chunkSize: 300,
          includeTitle: input.includeTitle ?? true,
        } satisfies z.infer<typeof createAudioFileChunksInput>,
      ]);
      return {
        audioFile,
      };
    }),
  createFromAi: authenticatedProcedure
    .input(
      z.object({
        text: z.string().min(1, "text is required"),
        speakerId: z.string(),
        chunkSize: z.number().int().positive().max(2000).optional(),
        durationMinutes: z
          .number({ invalid_type_error: "Enter minutes as a number" })
          .min(5)
          .max(120)
          .optional(),
        public: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
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

      const audioFile = await ctx.db.audioFile.create({
        data: {
          speakerId: input.speakerId,
          name: `AI Generated: ${input.text.slice(0, 20)}...`,
          ownerId: ctx.user.id,
          text: input.text,
          public: input.public,
        },
      });

      const task = client.createTask(TASK_NAMES.ai.generateStory);
      task.applyAsync([
        {
          audioFileId: audioFile.id,
          prompt: input.text,
          durationMinutes: input.durationMinutes ?? 5,
        } satisfies z.infer<typeof generateStoryInput>,
      ]);

      return {
        audioFile,
      };
    }),
  createFromChapters: authenticatedProcedure
    .input(
      z.object({
        text: z.string().min(1, "text is required"),
        name: z.string().min(2, "Please enter a name.").max(100),
        speakerId: z.string(),
        public: z.boolean(),
        chapters: z
          .array(
            z.object({
              title: z.string().min(1, "Chapter title is required"),
              type: sectionType,
              text: z.string().min(1, "Chapter text is required"),
            })
          )
          .min(1, "At least one chapter is required"),
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
          text: input.text,
          public: input.public,
        },
      });

      const task = client.createTask(
        TASK_NAMES.createAudioFileChunksFromChapters
      );
      task.applyAsync([
        {
          audioFileId: audioFile.id,
          chapters: input.chapters,
        } satisfies z.infer<typeof createAudioFileChunksFromChaptersInput>,
      ]);
      return {
        audioFile,
      };
    }),
  retry: authenticatedProcedure
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
