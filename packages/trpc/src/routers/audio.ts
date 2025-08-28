import z from "zod";
import {
  authenticatedProcedure,
  createTRPCRouter,
  publicProcedure,
} from "../trpc";
import { audioChunkRouter } from "./audioChunk";
import { audioFileSettingsRouter } from "./audioFileSettings";
import { inworldRouter } from "./inworld";

export const audioRouter = createTRPCRouter({
  inworld: inworldRouter,
  chunks: audioChunkRouter,
  settings: audioFileSettingsRouter,
  fetchAll: publicProcedure
    .input(
      z.object({
        page: z.number().optional().default(1),
        take: z.number().max(50).optional().default(10),
      })
    )
    .query(async ({ ctx, input }) => {
      if (!ctx.user) {
        return {
          audioFiles: [],
          count: 0,
        };
      }

      const [audioFiles, totalCount] = await Promise.all([
        ctx.db.audioFile.findMany({
          take: input.take,
          skip: (input.page - 1) * input.take,
          where: {
            deletedAt: null,
            ownerId: ctx.user.id,
          },
          orderBy: {
            createdAt: "desc",
          },
          select: {
            id: true,
            name: true,
            AudioChunks: true,
            speakerId: true,
            status: true,
            createdAt: true,
            deletedAt: true,
            speaker: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        }),
        ctx.db.audioFile.count({
          where: {
            deletedAt: null,
            ownerId: ctx.user.id,
          },
        }),
      ]);
      return { audioFiles, count: totalCount };
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
    .output(z.object({ audioFile: z.any() }))
    .query(async ({ ctx, input }) => {
      const audioFile = await ctx.db.audioFile.findUnique({
        where: {
          id: input.id,
          ownerId: ctx.user?.id ?? "",
        },
        include: {
          AudioFileSettings: true,
        },
      });
      return { audioFile };
    }),
});
