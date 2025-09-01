import { z } from "zod";
import {
  authenticatedProcedure,
  createTRPCRouter,
  publicProcedure,
} from "../trpc";

export const favoritesRouter = createTRPCRouter({
  add: authenticatedProcedure
    .input(
      z.object({
        audioFileId: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { audioFileId } = input;

      // Add the audio file to the user's favorites
      await ctx.db.userAudioFile.create({
        data: {
          userId: ctx.user.id,
          audioFileId,
        },
      });

      return {};
    }),

  delete: authenticatedProcedure
    .input(
      z.object({
        audioFileId: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { audioFileId } = input;

      // Remove the audio file from the user's favorites
      await ctx.db.userAudioFile.delete({
        where: {
          userId_audioFileId: {
            userId: ctx.user.id,
            audioFileId,
          },
        },
      });

      return {};
    }),

  fetch: authenticatedProcedure
    .input(
      z.object({
        audioFileId: z.string().uuid(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { audioFileId } = input;

      const favorite = await ctx.db.userAudioFile.findUnique({
        where: {
          userId_audioFileId: {
            userId: ctx.user.id,
            audioFileId,
          },
        },
      });

      return {
        favorite: favorite ? true : false,
      };
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
        return { audioFiles: [], nextCursor: undefined };
      }

      const userAudioFiles = await ctx.db.userAudioFile.findMany({
        where: {
          userId: ctx.user.id,
        },
        include: {
          audioFile: {
            include: {
              speaker: true,
            },
          },
        },
      });

      let nextCursor: string | undefined = undefined;
      if (userAudioFiles.length > input.limit) {
        const nextItem = userAudioFiles.pop();
        nextCursor = nextItem!.audioFileId;
      }

      return {
        audioFiles: userAudioFiles.flatMap((uf) => uf.audioFile),
        nextCursor,
      };
    }),
});
