import { openai } from "@ai-sdk/openai";
import { TRPCError } from "@trpc/server";
import { prisma, Prisma } from "@workspace/database";
import { generateObject } from "ai";
import crypto from "crypto";
import z from "zod";
import { reddit } from "../lib/reddit";
import { TASK_NAMES } from "../queue";
import { enqueueTask } from "../queue/enqueue";
import { adminProcedure, createTRPCRouter, queueProcedure } from "../trpc";
import { campaignsRouter } from "./campaign";
import {
  Category,
  scanSubredditInput,
  scoreRedditPostInput,
  scoreRedditPostsInput,
} from "./reddit/types";

export const redditRouter = createTRPCRouter({
  campaigns: campaignsRouter,
  searchSubreddits: adminProcedure
    .input(
      z.object({
        query: z.string().min(1),
        limit: z.number().min(1).max(200).default(50),
      })
    )
    .mutation(async ({ input }) => {
      const items = await reddit.searchSubreddits(input.query, {
        limit: input.limit,
      });
      return { items };
    }),
  searchSubredditsApi: adminProcedure
    .input(
      z.object({
        query: z.string().min(1),
        limit: z.number().min(1).max(200).default(50),
      })
    )
    .mutation(async ({ input }) => {
      const items = await reddit.searchSubredditsApi(input.query, {
        limit: input.limit,
      });
      return { items };
    }),
  getSubredditRules: adminProcedure
    .input(z.object({ subreddit: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const data = await reddit.getSubredditRules(input.subreddit);
      return data;
    }),
  getPostComments: adminProcedure
    .input(
      z.object({
        permalink: z.string().min(1),
        limit: z.number().min(1).max(500).optional(),
        depth: z.number().min(1).max(10).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const items = await reddit.getCommentsByPermalink(input.permalink, {
        limit: input.limit ?? 100,
        depth: input.depth ?? 5,
      });
      return { items };
    }),
  adminQueueScanSubreddit: adminProcedure
    .input(z.object({ subreddit: z.string().min(1) }))
    .mutation(async ({ input }) => {
      await queueScanSubreddit(input.subreddit);
      return { ok: true };
    }),
  scanWatchList: queueProcedure.mutation(async () => {
    await queueScanWatchedSubreddits({});
    return { ok: true };
  }),
  adminScanWatchList: adminProcedure
    .input(
      z.object({
        campaignId: z.string().uuid(),
      })
    )
    .mutation(async ({ input }) => {
      await queueScanWatchedSubreddits({ campaignId: input.campaignId });
      return { ok: true };
    }),
  scanSubreddit: queueProcedure
    .input(scanSubredditInput)
    .mutation(async ({ input, ctx }) => {
      const { subreddit, category } = input;
      const url = `https://www.reddit.com/r/${encodeURIComponent(
        subreddit
      )}/${category}.json?limit=25`;
      const res = await fetch(url, {
        headers: { "User-Agent": "workspace-cron/1.0" },
      });
      if (!res.ok)
        throw new Error(`Reddit fetch failed: ${res.status} ${res.statusText}`);

      const json = (await res.json()) as any;
      const children = Array.isArray(json?.data?.children)
        ? json.data.children
        : [];

      const rows = children.map((c: any) => {
        const d = c?.data ?? {};
        const baseId = d?.id ?? "";
        const redditId =
          (d?.name && String(d.name)) ||
          (baseId ? `t3_${baseId}` : crypto.randomUUID());
        return {
          redditId,
          subreddit,
          category,
          title: d?.title ?? "",
          author: d?.author ?? null,
          url: d?.url_overridden_by_dest ?? d?.url ?? null,
          permalink: d?.permalink ?? "",
          createdUtc: new Date((d?.created_utc ?? 0) * 1000),
          score: typeof d?.score === "number" ? d.score : null,
          selfText: d.selftext ?? null,
          numComments:
            typeof d?.num_comments === "number" ? d.num_comments : null,
        };
      });

      const created = await ctx.db.redditPost.createMany({
        data: rows,
        skipDuplicates: true,
      });
      return { ok: true, fetched: rows.length, inserted: created.count };
    }),

  scanSubredditWithSdk: queueProcedure
    .input(scanSubredditInput)
    .mutation(async ({ input, ctx }) => {
      const { subreddit, category } = input;
      const limit = 25;
      const sub = reddit.getSubreddit(subreddit);

      let items: any[] = [];
      switch (category) {
        case "hot":
          items = await sub.getHot({ limit });
          break;
        case "new":
          items = await sub.getNew({ limit });
          break;
        case "rising":
          items = await sub.getRising({ limit });
          break;
        case "top":
          items = await sub.getTop({ limit });
          break;
        case "controversial":
          items = await sub.getControversial({ limit });
          break;
      }

      const rows = items.map((d: any) => {
        const baseId = d?.id ?? "";
        const name = d?.name;
        const redditId =
          (name && String(name)) ||
          (baseId ? `t3_${baseId}` : crypto.randomUUID());
        const author =
          typeof d?.author === "string" ? d.author : (d?.author?.name ?? null);
        const createdSec =
          (typeof d?.created_utc === "number" ? d.created_utc : d?.created) ??
          0;
        return {
          redditId,
          subreddit,
          category,
          title: d?.title ?? "",
          author,
          url: d?.url_overridden_by_dest ?? d?.url ?? null,
          permalink: d?.permalink ?? "",
          createdUtc: new Date(createdSec * 1000),
          score: typeof d?.score === "number" ? d.score : null,
          selfText: d?.selftext ?? null,
          numComments:
            typeof d?.num_comments === "number" ? d.num_comments : null,
        };
      });

      const created = await ctx.db.redditPost.createMany({
        data: rows,
        skipDuplicates: true,
      });
      return { ok: true, fetched: rows.length, inserted: created.count };
    }),

  listPosts: adminProcedure
    .input(
      z.object({
        page: z.number().min(1).default(1),
        pageSize: z.number().min(1).max(100).default(25),
        subreddit: z.string().optional(),
        category: Category.optional(),
        search: z.string().optional(),
        campaignId: z.string().uuid().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      let campaignSubreddits: string[] | undefined;
      if (input.campaignId) {
        const watched = await ctx.db.watchedSubreddit.findMany({
          where: { campaignId: input.campaignId },
          select: { subreddit: true },
        });
        if (watched.length === 0) {
          return { items: [], total: 0 };
        }
        campaignSubreddits = watched.map((item) => item.subreddit);
      }

      const sanitizedInputSubreddit = input.subreddit?.trim();
      const normalizedInputSubreddit = sanitizedInputSubreddit?.toLowerCase();
      if (
        campaignSubreddits &&
        normalizedInputSubreddit &&
        !campaignSubreddits.some(
          (sub) => sub.trim().toLowerCase() === normalizedInputSubreddit
        )
      ) {
        return { items: [], total: 0 };
      }

      let subredditFilter: { equals: string } | { in: string[] } | undefined;
      if (campaignSubreddits) {
        if (normalizedInputSubreddit) {
          const matched = campaignSubreddits.find(
            (sub) => sub.trim().toLowerCase() === normalizedInputSubreddit
          );
          subredditFilter = matched
            ? { equals: matched }
            : sanitizedInputSubreddit
              ? { equals: sanitizedInputSubreddit }
              : undefined;
        } else {
          subredditFilter = { in: campaignSubreddits };
        }
      } else if (sanitizedInputSubreddit) {
        subredditFilter = { equals: sanitizedInputSubreddit };
      }

      const where = {
        subreddit: subredditFilter,
        category: input.category ? { equals: input.category } : undefined,
        OR: input.search
          ? [
              {
                title: { contains: input.search, mode: "insensitive" as const },
              },
              {
                author: {
                  contains: input.search,
                  mode: "insensitive" as const,
                },
              },
            ]
          : undefined,
      } as const;

      const [items, total] = await Promise.all([
        ctx.db.redditPost.findMany({
          where,
          orderBy: { createdUtc: "desc" },
          skip: (input.page - 1) * input.pageSize,
          take: input.pageSize,
        }),
        ctx.db.redditPost.count({ where }),
      ]);

      return { items, total };
    }),
  listWatchedSubreddit: adminProcedure.query(async ({ ctx }) => {
    const items = await ctx.db.watchedSubreddit.findMany({
      orderBy: { subreddit: "asc" },
    });
    return { items };
  }),
  upsertWatchedSubreddit: adminProcedure
    .input(z.object({ subreddit: z.string().min(1), campaignId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const item = await ctx.db.watchedSubreddit.upsert({
        where: {
          campaignId_subreddit: {
            campaignId: input.campaignId,
            subreddit: input.subreddit,
          },
        },
        update: { updatedAt: new Date() },
        create: { subreddit: input.subreddit, campaignId: input.campaignId },
      });
      return { ok: true, item };
    }),
  deleteWatchedSubreddit: adminProcedure
    .input(z.object({ subreddit: z.string().min(1), campaignId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      await ctx.db.watchedSubreddit.delete({
        where: {
          campaignId_subreddit: {
            campaignId: input.campaignId,
            subreddit: input.subreddit,
          },
        },
      });
      return { ok: true };
    }),
  /**
   * Count unscored posts for a campaign
   */
  countUnscoredPostsForCampaign: adminProcedure
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
  scoreRedditPosts: queueProcedure
    .input(scoreRedditPostsInput)
    .mutation(async ({ input, ctx }) => {
      const campaign = await ctx.db.campaign.findUnique({
        where: { id: input.campaignId },
        select: { id: true },
      });

      if (!campaign) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Campaign not found: ${input.campaignId}`,
        });
      }

      const watched = await ctx.db.watchedSubreddit.findMany({
        where: { campaignId: input.campaignId, subreddit: input.subreddit },
        select: { subreddit: true },
      });

      // Find posts without an evaluation in the watched subreddits for this campaign
      const posts = await ctx.db.redditPost.findMany({
        where: {
          evaluations: {
            every: {
              NOT: {
                campaignId: input.campaignId,
              },
            },
          },
          subreddit: {
            in: watched.map((w) => w.subreddit),
          },
        },
        orderBy: { createdUtc: "desc" },
      });

      if (posts.length === 0) return { ok: true, evaluated: 0 };

      for (const p of posts) {
        await enqueueTask(TASK_NAMES.scoreRedditPost, {
          postId: p.redditId,
          campaignId: input.campaignId,
        } satisfies z.infer<typeof scoreRedditPostInput>);
      }

      return { ok: true };
    }),

  scoreRedditPost: queueProcedure
    .input(scoreRedditPostInput)
    .mutation(async ({ input, ctx }) => {
      const campaign = await ctx.db.campaign.findUnique({
        where: { id: input.campaignId },
      });

      if (!campaign) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Campaign not found: ${input.campaignId}`,
        });
      }

      const defaultPrompt = `ROLE: You are an expert community + SEO strategist.
GOAL: Score how promising it is to post a helpful reply that naturally mentions ${campaign.name} to drive organic traffic.

SCORING (1–100): Higher is better. Consider:
- Relevance to the business description: ${campaign.description}
- Explicit need/pain (“how do I”, “tools for…”, “recommend”) vs. broad discussion
- Post tone: questions/requests > debates > memes
- Recency and engagement (score/comments) as signal of visibility
- Clear angle to add value without being spammy; can suggest a free useful tip + link

OUTPUT: JSON with { score: 1-100, reasoning: string, exampleMessage: string }. No extra keys.`;

      // Find post without an evaluation in the watched subreddits for this campaign
      const post = await ctx.db.redditPost.findFirst({
        where: {
          redditId: input.postId,
        },
      });

      if (!post) return { ok: true, evaluated: 0 };

      const model = openai("gpt-4o-mini");

      let evaluated = 0;

      try {
        const details = [
          `Subreddit: r/${post.subreddit}`,
          `Category: ${post.category}`,
          `Title: ${post.title}`,
          post.selfText ? `SelfText: ${post.selfText}` : null,
          post.author ? `Author: ${post.author}` : null,
          post.score != null ? `Reddit Score: ${post.score}` : null,
          post.numComments != null ? `Comments: ${post.numComments}` : null,
          `Permalink: https://www.reddit.com${post.permalink}`,
          post.url ? `Linked URL: ${post.url}` : null,
        ]
          .filter(Boolean)
          .join("\n");

        const { object } = await generateObject({
          model,
          schema: z.object({
            score: z
              .number()
              .int()
              .min(1)
              .max(100)
              .describe("Score from 1 to 100, higher is better."),
            reasoning: z
              .string()
              .min(3)
              .describe("Explanation for the score, short and concise."),
            exampleMessage: z
              .string()
              .min(3)
              .describe("An example message the user might have sent."),
          }),
          prompt: `${defaultPrompt}\n\n---
REDDIT POST
${details}\n---\nReturn only JSON.`,
        });

        const score = Math.max(1, Math.min(100, Math.round(object.score)));
        const reasoning = String(object.reasoning || "").slice(0, 4000);
        const exampleMessage = String(object.exampleMessage || "").slice(
          0,
          4000
        );

        // Upsert to guard against race; include campaignId if provided
        await ctx.db.redditPostEvaluation.create({
          data: {
            redditPostId: post.id,
            score,
            reasoning,
            modelName: "gpt-4o-mini",
            exampleMessage,
            campaignId: input.campaignId,
          },
        });
        evaluated++;
      } catch (err) {
        // Skip failures; continue with others
        // Optional: log to console; cron stdout shows it
        console.error("[scoreRedditPosts] eval failed for", post.id, err);
      }

      return { ok: true, evaluated };
    }),
  /** Admin list of evaluations with post join */
  listEvaluations: adminProcedure
    .input(
      z.object({
        page: z.number().min(1).default(1),
        pageSize: z.number().min(1).max(100).default(25),
        subreddit: z.string().optional(),
        minScore: z.number().min(1).max(100).optional(),
        search: z.string().optional(),
        campaignId: z.string().uuid().optional(),
        sort: z
          .object({
            field: z.enum(["createdAt", "score"]).default("createdAt"),
            dir: z.enum(["asc", "desc"]).default("desc"),
          })
          .optional()
          .default({ field: "createdAt", dir: "desc" }),
      })
    )
    .query(async ({ input, ctx }) => {
      const where = {
        campaignId: input.campaignId ? { equals: input.campaignId } : undefined,
        score: input.minScore ? { gte: input.minScore } : undefined,
        redditPost: {
          is: {
            subreddit: input.subreddit
              ? { equals: input.subreddit }
              : undefined,
            OR: input.search
              ? [
                  {
                    title: {
                      contains: input.search,
                      mode: "insensitive" as const,
                    },
                  },
                  {
                    author: {
                      contains: input.search,
                      mode: "insensitive" as const,
                    },
                  },
                ]
              : undefined,
          },
        },
      } satisfies Prisma.RedditPostEvaluationWhereInput;

      const [items, total] = await Promise.all([
        ctx.db.redditPostEvaluation.findMany({
          where,
          orderBy:
            input.sort?.field === "score"
              ? { score: input.sort.dir }
              : { createdAt: input.sort?.dir ?? "desc" },
          include: { redditPost: true },
          skip: (input.page - 1) * input.pageSize,
          take: input.pageSize,
        }),
        ctx.db.redditPostEvaluation.count({ where }),
      ]);

      return { items, total };
    }),
  /** Get daily counts of evaluations with score > 75 for a campaign */
  getEvaluationTimeSeries: adminProcedure
    .input(
      z.object({
        campaignId: z.string().uuid(),
        days: z.number().min(1).max(90).default(30),
      })
    )
    .query(async ({ input, ctx }) => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - input.days);
      startDate.setHours(0, 0, 0, 0);

      const evaluations = await ctx.db.redditPostEvaluation.findMany({
        where: {
          campaignId: input.campaignId,
          score: { gte: 75 },
          createdAt: { gte: startDate },
        },
        select: {
          createdAt: true,
        },
        orderBy: { createdAt: "asc" },
      });

      // Group by date
      const countsByDate = new Map<string, number>();

      // Initialize all dates with 0
      for (let i = 0; i < input.days; i++) {
        const date = new Date(startDate);
        date.setDate(date.getDate() + i);
        const dateKey = date.toISOString().split("T")[0]!;
        countsByDate.set(dateKey, 0);
      }

      // Count evaluations by date
      for (const evaluation of evaluations) {
        const dateKey = evaluation.createdAt.toISOString().split("T")[0]!;
        countsByDate.set(dateKey, (countsByDate.get(dateKey) ?? 0) + 1);
      }

      // Convert to array format
      const series = Array.from(countsByDate.entries())
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date));

      return { series };
    }),
});

async function queueScanWatchedSubreddits({
  campaignId,
}: {
  campaignId?: string;
}) {
  const watchedSubreddits = await prisma.watchedSubreddit.findMany({
    where: campaignId ? { campaignId } : undefined,
    select: { subreddit: true },
  });

  const deduped = new Set<string>();
  watchedSubreddits.forEach((r) => deduped.add(r.subreddit));

  const dedupedArray = Array.from(deduped);
  for (let i = 0; i < dedupedArray.length; i++) {
    await queueScanSubreddit(dedupedArray[i]!);
    // Throttle to avoid Reddit rate limits
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}

async function queueScanSubreddit(subreddit: string) {
  const cats: Category[] = ["new", "hot", "rising", "top", "controversial"];
  await Promise.all(
    cats.map((category) =>
      enqueueTask(TASK_NAMES.redditScanSubreddit, {
        subreddit,
        category,
      } satisfies z.infer<typeof scanSubredditInput>)
    )
  );
}
