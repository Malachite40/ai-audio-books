import z from "zod";
import { TASK_NAMES } from "../../queue";
import { enqueueTask } from "../../queue/enqueue";
import { adminProcedure, createTRPCRouter, queueProcedure } from "../../trpc";
import { scoreRedditPostsInput } from "../reddit/types";
import { queueScanWatchedSubreddits } from "./enqueueScan";

export const campaignsRouter = createTRPCRouter({
  upsert: adminProcedure
    .input(
      z.object({
        id: z.string().uuid().optional(),
        name: z.string().min(3).max(120),
        description: z.string().min(1).max(1000),
        isActive: z.boolean().optional(),
        autoArchiveScore: z
          .number()
          .int()
          .min(1)
          .max(100)
          .nullable()
          .optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const upserted = await ctx.db.campaign.upsert({
        where: { id: input.id ?? "" },
        create: {
          name: input.name,
          description: input.description,
          isActive: input.isActive ?? true,
          autoArchiveScore: input.autoArchiveScore ?? null,
        },
        update: {
          name: input.name,
          description: input.description,
          isActive: input.isActive,
          autoArchiveScore: input.autoArchiveScore ?? null,
        },
      });
      return { campaign: upserted };
    }),

  delete: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      await ctx.db.campaign.delete({ where: { id: input.id } });
      return { ok: true };
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
  adminScan: adminProcedure
    .input(
      z.object({
        campaignId: z.string().uuid(),
      })
    )
    .mutation(async ({ input }) => {
      await queueScanWatchedSubreddits({ campaignId: input.campaignId });
      return { ok: true };
    }),
  scan: queueProcedure.mutation(async () => {
    await queueScanWatchedSubreddits({});
    return { ok: true };
  }),
  countUnscored: adminProcedure
    .input(z.object({ campaignId: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const watched = await ctx.db.watchedSubreddit.findMany({
        where: { campaignId: input.campaignId },
        select: { subreddit: true },
      });

      const subreddits = watched.map((w) => w.subreddit);
      const count = await ctx.db.redditPost.count({
        where: {
          evaluations: {
            every: {
              NOT: {
                campaignId: input.campaignId,
              },
            },
          },
          subreddit: { in: subreddits },
        },
      });

      return { count };
    }),
});
