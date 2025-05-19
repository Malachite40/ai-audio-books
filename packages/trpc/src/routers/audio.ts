import z from "zod";
import { createTRPCRouter, publicProcedure } from "../trpc";
import { audioChunkRouter } from "./audioChunk";

export const audioRouter = createTRPCRouter({
  chunks: audioChunkRouter,
  create: publicProcedure.input(z.object({})).mutation(async ({ ctx }) => {
    const audioFile = await ctx.db.audioFile.create({
      data: {},
    });

    return { audioFile };
  }),
});
