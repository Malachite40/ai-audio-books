import { openai } from "@ai-sdk/openai";
import { TRPCError } from "@trpc/server";
import { Prisma } from "@workspace/database";
import { generateObject } from "ai";
import z from "zod";
import { TASK_NAMES } from "../../queue";
import { enqueueTask } from "../../queue/enqueue";
import { adminProcedure, createTRPCRouter, queueProcedure } from "../../trpc";
import { scoreRedditPostInput, scoreRedditPostsInput } from "../reddit/types";

export const evaluationsRouter = createTRPCRouter({
  fetchAll: adminProcedure
    .input(
      z.object({
        page: z.number().min(1).default(1),
        pageSize: z.number().min(1).max(100).default(25),
        subreddit: z.string().optional(),
        minScore: z.number().min(1).max(100).optional(),
        search: z.string().optional(),
        campaignId: z.string().uuid().optional(),
        archived: z.boolean().optional(),
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
        archived:
          input.archived != null ? { equals: input.archived } : undefined,
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
              ? [{ score: input.sort.dir }, { createdAt: "desc" }]
              : { createdAt: input.sort?.dir ?? "desc" },
          include: { redditPost: true },
          skip: (input.page - 1) * input.pageSize,
          take: input.pageSize,
        }),
        ctx.db.redditPostEvaluation.count({ where }),
      ]);

      return { items, total };
    }),

  getTimeSeries: adminProcedure
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
          redditPost: {
            select: { subreddit: true },
          },
        },
        orderBy: { createdAt: "asc" },
      });

      // Map of subreddit -> Map<date, count>
      const countsBySubreddit = new Map<string, Map<string, number>>();
      const totalsByDate = new Map<string, number>();

      // Initialize all dates for totals with 0
      for (let i = 0; i < input.days; i++) {
        const date = new Date(startDate);
        date.setDate(date.getDate() + i);
        const dateKey = date.toISOString().split("T")[0]!;
        totalsByDate.set(dateKey, 0);
      }

      // Count evaluations by date and subreddit
      for (const evaluation of evaluations) {
        const dateKey = evaluation.createdAt.toISOString().split("T")[0]!;
        const subreddit = evaluation.redditPost?.subreddit ?? "unknown";

        if (!countsBySubreddit.has(subreddit)) {
          countsBySubreddit.set(subreddit, new Map<string, number>());
        }
        const subMap = countsBySubreddit.get(subreddit)!;
        subMap.set(dateKey, (subMap.get(dateKey) ?? 0) + 1);

        totalsByDate.set(dateKey, (totalsByDate.get(dateKey) ?? 0) + 1);
      }

      // Build a sorted list of all date keys
      const allDates = Array.from(totalsByDate.keys()).sort((a, b) =>
        a.localeCompare(b)
      );

      const series = allDates.map((date) => {
        const total = totalsByDate.get(date) ?? 0;
        const subredditCounts: Record<string, number> = {};

        for (const [subreddit, subMap] of countsBySubreddit.entries()) {
          subredditCounts[subreddit] = subMap.get(date) ?? 0;
        }

        return {
          date,
          total,
          subreddits: subredditCounts,
        };
      });

      return { series };
    }),

  archive: adminProcedure
    .input(
      z.object({
        id: z.string().uuid(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await ctx.db.redditPostEvaluation.update({
        where: { id: input.id },
        data: { archived: true },
      });

      return { ok: true };
    }),

  quickArchiveByScore: adminProcedure
    .input(
      z.object({
        campaignId: z.string().uuid(),
        maxScore: z.number().min(1).max(100),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const result = await ctx.db.redditPostEvaluation.updateMany({
        where: {
          campaignId: input.campaignId,
          archived: false,
          score: { lt: input.maxScore },
        },
        data: { archived: true },
      });

      return { ok: true, archived: result.count };
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
        select: {
          id: true,
          name: true,
          description: true,
          autoArchiveScore: true,
        },
      });

      if (!campaign) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Campaign not found: ${input.campaignId}`,
        });
      }

      const defaultPrompt = [
        "ROLE: You are an expert community + SEO strategist.",
        `GOAL: Score how promising it is to post a helpful reply that naturally mentions ${campaign.name} to drive organic traffic.`,
        "",
        "SCORING (1–100): Higher is better. Consider:",
        `- Relevance to the business description: ${campaign.description}`,
        "- Explicit need/pain (“how do I”, “tools for…”, “recommend”) vs. broad discussion",
        "- Post tone: questions/requests > debates > memes",
        "- Recency and engagement (score/comments) as signal of visibility",
        "- Clear angle to add value without being spammy; can suggest a free useful tip + link",
        "",
        "OUTPUT: JSON with { score: 1-100, reasoning: string, exampleMessage: string }. No extra keys.",
      ].join("\n");

      // Find post without an evaluation in the watched subreddits for this campaign
      const post = await ctx.db.redditPost.findFirst({
        where: {
          redditId: input.postId,
        },
      });

      if (!post) return { ok: true, evaluated: 0 };

      const pinnedPositiveExamples = await ctx.db.redditPostEvaluation.findMany(
        {
          where: {
            campaignId: input.campaignId,
            bookmarked: true,
            rating: "POSITIVE",
          },
          orderBy: { createdAt: "desc" },
          take: 20,
          include: {
            redditPost: {
              select: {
                title: true,
                subreddit: true,
              },
            },
          },
        }
      );

      const model = openai("gpt-4o-mini");

      const pinnedPositiveExamplesSection =
        pinnedPositiveExamples.length > 0
          ? [
              "Pinned positive examples for campaign context:",
              "Use these samples to understand the campaign's preferred tone, value angle, and scoring priorities before you score the new post. Incorporate similar reasoning and style where relevant.",
              ...pinnedPositiveExamples.map((example, index) => {
                const postTitle = example.redditPost.title ?? "Untitled post";
                const snippet = `
                --- Sample ${index + 1} ---
                Posted Title: ${postTitle}
                Score: ${example.score}
                Example Message: ${example.exampleMessage?.trim()}
                Reasoning: ${example.reasoning?.trim()}
                User Feedback: ${example.rating}
                `.trim();
                return snippet;
              }),
            ].join("\n\n")
          : "";

      const pinnedNegativeExamples = await ctx.db.redditPostEvaluation.findMany(
        {
          where: {
            campaignId: input.campaignId,
            bookmarked: true,
            rating: "NEGATIVE",
          },
          orderBy: { createdAt: "desc" },
          take: 20,
          include: {
            redditPost: {
              select: {
                title: true,
                subreddit: true,
              },
            },
          },
        }
      );

      const pinnedNegativeExamplesSection =
        pinnedNegativeExamples.length > 0
          ? [
              "Pinned negative examples for campaign context:",
              "Use these samples to understand the campaign doesn't prefer. Avoid similar pitfalls when scoring the new post.",
              ...pinnedNegativeExamples.map((example, index) => {
                const postTitle = example.redditPost.title ?? "Untitled post";
                const snippet = `
                --- Sample ${index + 1} ---
                Posted Title: ${postTitle}
                Score: ${example.score}
                Example Message: ${example.exampleMessage?.trim()}
                Reasoning: ${example.reasoning?.trim()}
                User Feedback: ${example.rating}
                `.trim();
                return snippet;
              }),
            ].join("\n\n")
          : "";

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
          prompt: [
            defaultPrompt,
            pinnedPositiveExamplesSection,
            pinnedNegativeExamplesSection,
            `---\nREDDIT POST TO EVALUATE\n${details}\n---\nReturn only JSON.`,
          ]
            .filter(Boolean)
            .join("\n\n"),
        });

        const score = Math.max(1, Math.min(100, Math.round(object.score)));
        const reasoning = String(object.reasoning || "").slice(0, 4000);
        const exampleMessage = String(object.exampleMessage || "").slice(
          0,
          4000
        );

        const shouldArchive =
          campaign.autoArchiveScore != null &&
          score < campaign.autoArchiveScore;

        // Upsert to guard against race; include campaignId if provided
        await ctx.db.redditPostEvaluation.create({
          data: {
            redditPostId: post.id,
            score,
            reasoning,
            modelName: "gpt-4o-mini",
            exampleMessage,
            campaignId: input.campaignId,
            archived: shouldArchive,
          },
        });
      } catch (err) {
        // Skip failures; continue with others
        // Optional: log to console; cron stdout shows it
        console.error("[scoreRedditPosts] eval failed for", post.id, err);
      }

      return { ok: true };
    }),

  bookmark: adminProcedure
    .input(
      z.object({
        evaluationId: z.string().uuid(),
        bookmarked: z.boolean(),
        exampleMessage: z.string().optional(),
        score: z.number().min(1).max(100).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await ctx.db.redditPostEvaluation.update({
        where: { id: input.evaluationId },
        data: {
          bookmarked: input.bookmarked,
          exampleMessage: input.exampleMessage,
          score: input.score,
        },
      });
      return {};
    }),

  updateRating: adminProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        direction: z.enum(["up", "down", "clear"]).default("up"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const rating: Prisma.RedditPostEvaluationUpdateInput["rating"] =
        input.direction === "up"
          ? "POSITIVE"
          : input.direction === "down"
            ? "NEGATIVE"
            : "UNRATED";

      const evaluation = await ctx.db.redditPostEvaluation.update({
        where: { id: input.id },
        data: { rating },
      });

      return { ok: true, evaluation };
    }),
});
