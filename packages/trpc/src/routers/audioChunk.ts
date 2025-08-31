import { TRPCError } from "@trpc/server";
import z from "zod";
import { createTRPCRouter, publicProcedure } from "../trpc";

export const audioChunkRouter = createTRPCRouter({
  setPadding: publicProcedure
    .input(
      z.object({
        audioChunkId: z.string().uuid(),
        paddingStartMs: z.number().min(0),
        paddingEndMs: z.number().min(0),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const audioChunk = await ctx.db.audioChunk.findUnique({
        where: { id: input.audioChunkId },
      });

      if (!audioChunk) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Audio chunk with ID ${input.audioChunkId} not found`,
        });
      }

      await ctx.db.audioChunk.update({
        where: { id: input.audioChunkId },
        data: {
          paddingStartMs: input.paddingStartMs,
          paddingEndMs: input.paddingEndMs,
        },
      });

      return { success: true };
    }),
  setPaddingForAll: publicProcedure
    .input(
      z.object({
        audioFileId: z.string().uuid(),
        paddingStartMs: z.number().min(0),
        paddingEndMs: z.number().min(0),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const audioFile = await ctx.db.audioFile.findUnique({
        where: { id: input.audioFileId },
      });

      if (!audioFile) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Audio file with ID ${input.audioFileId} not found`,
        });
      }

      await ctx.db.audioChunk.updateMany({
        where: { audioFileId: input.audioFileId },
        data: {
          paddingStartMs: input.paddingStartMs,
          paddingEndMs: input.paddingEndMs,
        },
      });

      return { success: true };
    }),
});
