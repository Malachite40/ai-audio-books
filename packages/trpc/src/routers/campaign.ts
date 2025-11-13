import z from "zod";
import { TASK_NAMES } from "../queue";
import { enqueueTask } from "../queue/enqueue";
import { adminProcedure, createTRPCRouter, queueProcedure } from "../trpc";
import { scoreRedditPostsInput } from "./reddit/types";

export const campaignsRouter = createTRPCRouter({
  upsert: adminProcedure
    .input(
      z.object({
        id: z.string().uuid().optional(),
        name: z.string().min(3).max(120),
        description: z.string().min(1).max(1000),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const upserted = await ctx.db.campaign.upsert({
        where: { id: input.id ?? "" },
        create: {
          name: input.name,
          description: input.description,
          isActive: input.isActive ?? true,
        },
        update: {
          name: input.name,
          description: input.description,
          isActive: input.isActive,
        },
      });
      return { campaign: upserted };
    }),

  fetchAll: adminProcedure.query(async ({ ctx }) => {
    const items = await ctx.db.campaign.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        watchedSubreddit: {
          orderBy: { subreddit: "asc" },
        },
        _count: {
          select: {
            watchedSubreddit: true,
            evaluations: true,
          },
        },
      },
    });
    return { items };
  }),
  fetch: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const campaign = await ctx.db.campaign.findUnique({
        where: { id: input.id },
        include: {
          watchedSubreddit: {
            orderBy: { subreddit: "asc" },
          },
          _count: {
            select: {
              watchedSubreddit: true,
              evaluations: true,
            },
          },
        },
      });
      return { campaign };
    }),

  adminQueueScorePosts: adminProcedure
    .input(z.object({ campaignId: z.string().uuid() }))
    .mutation(async ({ input }) => {
      await enqueueTask(TASK_NAMES.scoreRedditPosts, {
        campaignId: input.campaignId,
      } satisfies z.infer<typeof scoreRedditPostsInput>);
      return { ok: true };
    }),

  queueAllPostsToScore: queueProcedure.mutation(async ({ ctx }) => {
    const campaigns = await ctx.db.campaign.findMany({
      where: { isActive: true },
      select: { id: true },
    });

    for (const campaign of campaigns) {
      await enqueueTask(TASK_NAMES.scoreRedditPosts, {
        campaignId: campaign.id,
      } satisfies z.infer<typeof scoreRedditPostsInput>);
    }

    return { ok: true };
  }),
});
