import { DeleteObjectCommand, DeleteObjectsCommand } from "@aws-sdk/client-s3";
import { TRPCError } from "@trpc/server";
import z from "zod";
import { env } from "../env";
import { TASK_NAMES } from "../queue";
import { client } from "../queue/client";
import { s3Client } from "../s3";
import {
  adminProcedure,
  authenticatedProcedure,
  createTRPCRouter,
  publicProcedure,
} from "../trpc";
import { audioChunkRouter } from "./audioChunk";
import { audioFileSettingsRouter } from "./audioFileSettings";
import { audioFileTestRouter } from "./audioFileTest";
import { favoritesRouter } from "./favoritesRouter";
import { inworldRouter } from "./inworld";
import { concatAudioFileInput } from "./workers";

export const audioRouter = createTRPCRouter({
  // Admin: fetch a single audio file with speaker and owner
  adminFetchById: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const audioFile = await ctx.db.audioFile.findUnique({
        where: { id: input.id },
        include: {
          speaker: true,
          owner: { select: { id: true, name: true, email: true } },
        },
      });
      if (!audioFile) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Audio file not found",
        });
      }

      return { audioFile };
    }),

  // Admin: fetch all audio files with pagination (page/pageSize) and optional filters
  fetchAllAdmin: adminProcedure
    .input(
      z.object({
        page: z.number().min(1).default(1),
        pageSize: z.number().min(1).max(100).default(20),
        q: z.string().optional(),
        status: z
          .enum([
            "PENDING",
            "GENERATING_STORY",
            "PROCESSING",
            "PROCESSED",
            "ERROR",
          ]) // AudioFileStatus
          .optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const where: any = {
        deletedAt: null,
      };

      if (input.q && input.q.trim() !== "") {
        const q = input.q.trim();
        where.OR = [
          { name: { contains: q, mode: "insensitive" } },
          { id: { equals: q } },
        ];
      }

      if (input.status) {
        where.status = input.status;
      }

      const [audioFiles, total] = await Promise.all([
        ctx.db.audioFile.findMany({
          skip: (input.page - 1) * input.pageSize,
          take: input.pageSize,
          where,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            ownerId: true,
            name: true,
            // text intentionally omitted (can be large)
            imageUrl: true,
            status: true,
            speakerId: true,
            durationMs: true,
            public: true,
            lang: true,
            createdAt: true,
            updatedAt: true,
            deletedAt: true,
            speaker: true,
            owner: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true,
                banned: true,
              },
            },
          },
        }),
        ctx.db.audioFile.count({ where }),
      ]);

      return { audioFiles, total };
    }),

  // Admin: list audio files for a specific user (paginated)
  adminListByUser: adminProcedure
    .input(
      z.object({
        userId: z.string(),
        page: z.number().min(1).default(1),
        pageSize: z.number().min(1).max(100).default(20),
        status: z
          .enum([
            "PENDING",
            "GENERATING_STORY",
            "PROCESSING",
            "PROCESSED",
            "ERROR",
          ])
          .optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const where: any = {
        deletedAt: null,
        ownerId: input.userId,
      };
      if (input.status) where.status = input.status;

      const [audioFiles, total] = await Promise.all([
        ctx.db.audioFile.findMany({
          skip: (input.page - 1) * input.pageSize,
          take: input.pageSize,
          where,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            ownerId: true,
            name: true,
            imageUrl: true,
            status: true,
            speakerId: true,
            durationMs: true,
            public: true,
            lang: true,
            createdAt: true,
            updatedAt: true,
            speaker: true,
          },
        }),
        ctx.db.audioFile.count({ where }),
      ]);

      return { audioFiles, total };
    }),
  // Admin: list audio chunks for a file (paginated)
  adminListChunks: adminProcedure
    .input(
      z.object({
        audioFileId: z.string().uuid(),
        page: z.number().min(1).default(1),
        pageSize: z.number().min(1).max(200).default(50),
        status: z
          .enum(["PENDING", "PROCESSING", "PROCESSED", "ERROR"])
          .optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const where: any = { audioFileId: input.audioFileId };
      if (input.status) where.status = input.status;

      const [items, total] = await Promise.all([
        ctx.db.audioChunk.findMany({
          skip: (input.page - 1) * input.pageSize,
          take: input.pageSize,
          where,
          orderBy: { sequence: "asc" },
          select: {
            id: true,
            sequence: true,
            status: true,
            url: true,
            text: true,
            durationMs: true,
            paddingStartMs: true,
            paddingEndMs: true,
            createdAt: true,
          },
        }),
        ctx.db.audioChunk.count({ where }),
      ]);

      return { items, total };
    }),
  /**
   * Returns the count of audio chunks for a given audioFileId, grouped by status.
   * Example output: { PROCESSED: 10, ERROR: 1, PENDING: 2 }
   */
  chunkStatusCounts: publicProcedure
    .input(z.object({ audioFileId: z.string() }))
    .query(async ({ ctx, input }) => {
      const counts = await ctx.db.audioChunk.groupBy({
        by: ["status"],
        where: { audioFileId: input.audioFileId },
        _count: { status: true },
      });
      return { counts };
    }),
  inworld: inworldRouter,
  test: audioFileTestRouter,
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
      task.applyAsync([
        { id: input.audioFileId, overwrite: true } as z.infer<
          typeof concatAudioFileInput
        >,
      ]);
    }),

  // Admin: re-queue processing for an audio file
  requeue: adminProcedure
    .input(
      z.object({
        audioFileId: z.string().uuid(),
        mode: z.enum(["failed", "full", "concat"]),
        chunkSize: z.number().min(1).max(2000).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const file = await ctx.db.audioFile.findUnique({
        where: { id: input.audioFileId },
        select: { id: true, deletedAt: true, text: true },
      });
      if (!file || file.deletedAt) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Audio file not found",
        });
      }

      if (input.mode === "failed") {
        // re-enqueue all non-PROCESSED chunks
        const chunks = await ctx.db.audioChunk.findMany({
          where: {
            audioFileId: input.audioFileId,
            status: { notIn: ["PROCESSED"] },
          },
          select: { id: true },
        });
        if (chunks.length === 0) return {};
        const task = client.createTask(TASK_NAMES.processAudioChunkWithInworld);
        await Promise.all(chunks.map((c) => task.applyAsync([{ id: c.id }])));
        await ctx.db.audioFile.update({
          where: { id: input.audioFileId },
          data: { status: "PROCESSING" },
        });
        return {};
      }

      if (input.mode === "full") {
        // drop all chunks and rebuild from text
        await ctx.db.audioChunk.deleteMany({
          where: { audioFileId: input.audioFileId },
        });
        const task = client.createTask(TASK_NAMES.createAudioFileChunks);
        task.applyAsync([
          {
            audioFileId: input.audioFileId,
            chunkSize: input.chunkSize ?? 300,
            includeTitle: true,
          },
        ]);
        await ctx.db.audioFile.update({
          where: { id: input.audioFileId },
          data: { status: "PENDING", durationMs: 0 },
        });
        return {};
      }

      // concat
      const audioChunks = await ctx.db.audioChunk.count({
        where: {
          audioFileId: input.audioFileId,
          status: { notIn: ["PROCESSED"] },
        },
      });
      if (audioChunks > 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Audio file has ${audioChunks} unprocessed chunks. Cannot re-stitch until all chunks are processed.`,
        });
      }
      const task = client.createTask(TASK_NAMES.concatAudioFile);
      task.applyAsync([
        { id: input.audioFileId, overwrite: true } as z.infer<
          typeof concatAudioFileInput
        >,
      ]);
      return {};
    }),

  // Admin: delete an audio file (soft/hard) optionally purging assets
  adminDelete: adminProcedure
    .input(
      z.object({
        audioFileId: z.string().uuid(),
        type: z.enum(["soft", "hard"]),
        purgeAssets: z.boolean().optional().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const file = await ctx.db.audioFile.findUnique({
        where: { id: input.audioFileId },
        select: { id: true, deletedAt: true },
      });
      if (!file)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Audio file not found",
        });

      if (input.type === "soft") {
        if (file.deletedAt) return {};
        await ctx.db.audioFile.update({
          where: { id: input.audioFileId },
          data: { deletedAt: new Date() },
        });
        return {};
      }

      // hard delete
      if (input.purgeAssets) {
        // build keys: final and chunk keys
        const chunks = await ctx.db.audioChunk.findMany({
          where: { audioFileId: input.audioFileId },
          select: { sequence: true },
          orderBy: { sequence: "asc" },
        });
        const bucket = env.NEXT_PUBLIC_CLOUD_FLARE_AUDIO_BUCKET_NAME;
        const finalKey = `audio/${input.audioFileId}.mp3`;
        const objects = [
          { Key: finalKey },
          ...chunks.map((c) => ({
            Key: `audio/${input.audioFileId}/chunks/${String(c.sequence).padStart(7, "0")}.mp3`,
          })),
        ];
        try {
          if (objects.length === 1) {
            await s3Client.send(
              new DeleteObjectCommand({ Bucket: bucket, Key: finalKey })
            );
          } else {
            await s3Client.send(
              new DeleteObjectsCommand({
                Bucket: bucket,
                Delete: { Objects: objects },
              })
            );
          }
        } catch (e) {
          // Log and continue; purging storage is best-effort
          console.error("Failed to purge R2 objects for", input.audioFileId, e);
        }
      }

      await ctx.db.audioFile.delete({ where: { id: input.audioFileId } });
      return {};
    }),

  // Admin: toggle public/private flag
  togglePublic: adminProcedure
    .input(z.object({ audioFileId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.audioFile.findUnique({
        where: { id: input.audioFileId },
        select: { public: true, deletedAt: true },
      });
      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Audio file not found",
        });
      }
      if (existing.deletedAt) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot toggle a deleted audio file",
        });
      }
      const updated = await ctx.db.audioFile.update({
        where: { id: input.audioFileId },
        data: { public: !existing.public },
        select: { public: true },
      });
      return { public: updated.public };
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
  fetchPartial: publicProcedure
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
        select: {
          id: true,
          name: true,
          status: true,
          public: true,
          imageUrl: true,
          speaker: true,
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
  fetchText: publicProcedure
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
        select: {
          id: true,
          text: true,
        },
      });
      return { audioFile };
    }),
});
