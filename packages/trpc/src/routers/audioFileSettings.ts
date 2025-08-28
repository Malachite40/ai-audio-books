import z from "zod";
import { authenticatedProcedure, createTRPCRouter } from "../trpc";

export const audioFileSettingsRouter = createTRPCRouter({
  upsert: authenticatedProcedure
    .input(z.object({ id: z.string().uuid(), currentTime: z.number().min(0) }))
    .mutation(async ({ input, ctx }) => {
      // For now, just create a blank settings row if one doesn't exist.
      // We can add more fields later.
      await ctx.db.audioFileSettings.upsert({
        where: {
          audioFileId_userId: {
            audioFileId: input.id,
            userId: ctx.user.id,
          },
        },
        create: {
          audioFileId: input.id,
          userId: ctx.user.id,
          currentTime: 1.0,
        },
        update: {
          currentTime: input.currentTime,
        },
      });
    }),
});
