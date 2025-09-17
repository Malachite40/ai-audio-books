import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { TASK_NAMES } from "../queue";
import { client } from "../queue/client";
import { authenticatedProcedure, createTRPCRouter } from "../trpc";
import { audioChunkInput, createAudioFileChunksInput } from "./workers";
import { generateStoryInput } from "./workers/ai";

export const createInworldAudioFileInput = z.object({
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

export const inworldRouter = createTRPCRouter({
  create: authenticatedProcedure
    .input(createInworldAudioFileInput)
    .mutation(async ({ ctx, input }) => {
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
      }

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

      if (input.mode === "ai") {
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
      }

      const task = client.createTask(TASK_NAMES.createAudioFileChunks);
      task.applyAsync([
        {
          audioFileId: audioFile.id,
          chunkSize: 300,
        } satisfies z.infer<typeof createAudioFileChunksInput>,
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
