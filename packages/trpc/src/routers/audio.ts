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
        limit: z.number().min(1).max(50).default(10),
        cursor: z.string().nullish(),
      })
    )
    .query(
      async ({
        ctx,
        input,
      }: {
        ctx: import("../context").BaseContext;
        input: { limit: number; cursor?: string | null };
      }) => {
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
        });

        let nextCursor: string | undefined = undefined;
        if (audioFiles.length > input.limit) {
          const nextItem = audioFiles.pop();
          nextCursor = nextItem!.id;
        }

        return { audioFiles, nextCursor };
      }
    ),
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
      const audioFile = await ctx.db.audioFile.findUnique({
        where: {
          id: input.id,
          deletedAt: null,
          OR: [
            ctx.user
              ? {
                  ownerId: ctx.user.id,
                }
              : {
                  public: true,
                },
          ],
        },
        include: {
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
