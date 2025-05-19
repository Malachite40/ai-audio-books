import { TRPCError } from "@trpc/server";
import z from "zod";
import { createTRPCRouter, publicProcedure } from "../trpc";

export const audioChunkRouter = createTRPCRouter({
  fetchAll: publicProcedure
    .input(
      z.object({
        audioFileId: z.string().uuid(),
      })
    )
    .query(async ({ ctx, input }) => {
      const audioFile = await ctx.db.audioFile.findUnique({
        where: { id: input.audioFileId },
        include: {
          AudioChunks: {
            orderBy: {
              sequence: "asc",
            },
          },
        },
      });

      if (!audioFile) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Audio file with ID ${input.audioFileId} not found`,
        });
      }

      return { audioFile };
    }),
});
