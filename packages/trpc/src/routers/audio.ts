import { TRPCError } from "@trpc/server";
import z from "zod";
import { TASK_NAMES } from "../queue";
import { client } from "../queue/client";
import {
  adminProcedure,
  authenticatedProcedure,
  createTRPCRouter,
  publicProcedure,
} from "../trpc";
import { audioChunkRouter } from "./audioChunk";
import { audioFileSettingsRouter } from "./audioFileSettings";
import { favoritesRouter } from "./favoritesRouter";
import { inworldRouter } from "./inworld";
import { concatAudioFileInput } from "./workers";

export const audioRouter = createTRPCRouter({
  inworld: inworldRouter,
  chunks: audioChunkRouter,
  settings: audioFileSettingsRouter,
  favorites: favoritesRouter,

  queueConcatAudioFile: adminProcedure
    .input(z.object({ audioFileId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const audioChunks = await ctx.db.audioChunk.count({
        where: {
          audioFileId: input.audioFileId,
          status: {
            notIn: ["PROCESSED"],
          },
        },
      });

      if (audioChunks > 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Audio file with ID ${input.audioFileId} has ${audioChunks} unprocessed chunks. Cannot re-stitch until all chunks are processed.`,
        });
      }

      const task = client.createTask(TASK_NAMES.concatAudioFile);
      await task.applyAsync([
        { id: input.audioFileId, overwrite: true } as z.infer<
          typeof concatAudioFileInput
        >,
      ]);
    }),

  fetchAll: publicProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(50).default(10),
        cursor: z.string().nullish(),
      })
    )
    .query(async ({ ctx, input }) => {
      if (!ctx.user) {
        return {
          audioFiles: [],
          nextCursor: undefined,
        };
      }

      const audioFiles = await ctx.db.audioFile.findMany({
        take: input.limit + 1,
        where: {
          deletedAt: null,
          ownerId: ctx.user.id,
        },
        orderBy: {
          createdAt: "desc",
        },
        cursor: input.cursor ? { id: input.cursor } : undefined,
        include: {
          AudioChunks: true,
          speaker: true,
        },
      });

      let nextCursor: string | undefined = undefined;
      if (audioFiles.length > input.limit) {
        const nextItem = audioFiles.pop();
        nextCursor = nextItem!.id;
      }

      return { audioFiles, nextCursor };
    }),
  delete: authenticatedProcedure
    .input(
      z.object({
        id: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.db.audioFile.update({
        where: {
          id: input.id,
          ownerId: ctx.user.id,
        },
        data: {
          deletedAt: new Date(),
        },
      });
    }),
  fetch: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const audioFile = await ctx.db.audioFile.findFirst({
        where: {
          id: input.id,
          deletedAt: null,
          OR: [
            { public: true },
            ...(ctx.user ? [{ ownerId: ctx.user.id }] : []),
          ],
        },
        include: {
          speaker: true,
          AudioChunks: {
            orderBy: {
              sequence: "asc",
            },
          },
          AudioFileSettings: ctx.user
            ? {
                where: {
                  userId: ctx.user.id,
                },
              }
            : false,
        },
      });
      return { audioFile };
    }),
});
