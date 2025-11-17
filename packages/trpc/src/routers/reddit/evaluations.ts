import { TRPCError } from "@trpc/server";
import { Prisma } from "@workspace/database";
import { generateObject, type LanguageModel } from "ai";
import { subDays } from "date-fns";
import z from "zod";
import { openrouter } from "../../lib/openrouter";
import { TASK_NAMES } from "../../queue";
import { enqueueTask } from "../../queue/enqueue";
import { adminProcedure, createTRPCRouter, queueProcedure } from "../../trpc";
import {
  EVAL_QUEUE_DELAY_MS,
  scoreRedditPostInput,
  scoreRedditPostsInput,
} from "../reddit/types";
export const evaluationsRouter = createTRPCRouter({
  fetchAll: adminProcedure
    .input(
      z.object({
        page: z.number().min(1).default(1),
        pageSize: z.number().min(1).max(100).default(25),
        subreddit: z.string().optional(),
        minScore: z.number().min(1).max(100).optional(),
        search: z.string().optional(),
        campaignId: z.string().uuid(),
        archived: z.boolean().optional(),
        sort: z
          .object({
            field: z
              .enum(["createdAt", "score", "bookmarked"])
              .default("createdAt"),
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
              : input.sort?.field === "bookmarked"
                ? [{ bookmarked: input.sort.dir }, { createdAt: "desc" }]
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
      const totalsByInterval = new Map<string, number>();

      // Count evaluations by hour and subreddit
      for (const evaluation of evaluations) {
        const createdAt = evaluation.createdAt;
        const dateKey = new Date(
          createdAt.getFullYear(),
          createdAt.getMonth(),
          createdAt.getDate(),
          createdAt.getHours(),
          0,
          0,
          0
        )
          .toISOString()
          .slice(0, 13); // e.g. "2025-11-15T13"
        const subreddit = evaluation.redditPost?.subreddit ?? "unknown";

        if (!countsBySubreddit.has(subreddit)) {
          countsBySubreddit.set(subreddit, new Map<string, number>());
        }
        const subMap = countsBySubreddit.get(subreddit)!;
        subMap.set(dateKey, (subMap.get(dateKey) ?? 0) + 1);

        totalsByInterval.set(dateKey, (totalsByInterval.get(dateKey) ?? 0) + 1);
      }

      // Ensure a continuous series of hourly intervals from startDate to now
      const allIntervals: string[] = [];
      const current = new Date(startDate);
      const end = new Date();

      while (current <= end) {
        const hourKey = new Date(
          current.getFullYear(),
          current.getMonth(),
          current.getDate(),
          current.getHours(),
          0,
          0,
          0
        )
          .toISOString()
          .slice(0, 13);
        allIntervals.push(hourKey);
        current.setHours(current.getHours() + 1);
      }

      const series = allIntervals.map((interval) => {
        const total = totalsByInterval.get(interval) ?? 0;
        const subredditCounts: Record<string, number> = {};

        for (const [subreddit, subMap] of countsBySubreddit.entries()) {
          subredditCounts[subreddit] = subMap.get(interval) ?? 0;
        }

        return {
          interval,
          total,
          subreddits: subredditCounts,
        };
      });

      return { series };
    }),

  getHighScoreShare: adminProcedure
    .input(
      z.object({
        campaignId: z.string().uuid(),
        subreddit: z.string(),
        days: z.number().min(1).max(90).default(30),
      })
    )
    .query(async ({ input, ctx }) => {
      const campaign = await ctx.db.campaign.findUnique({
        where: { id: input.campaignId },
        select: { autoArchiveScore: true },
      });

      const threshold = campaign?.autoArchiveScore ?? 75;

      const since = new Date();
      since.setDate(since.getDate() - input.days);

      const baseWhere: Prisma.RedditPostEvaluationWhereInput = {
        campaignId: input.campaignId,
        createdAt: { gte: since },
        redditPost: {
          subreddit: input.subreddit,
        },
      };

      const [total, above] = await Promise.all([
        ctx.db.redditPostEvaluation.count({
          where: baseWhere,
        }),
        ctx.db.redditPostEvaluation.count({
          where: {
            ...baseWhere,
            score: { gte: threshold },
          },
        }),
      ]);

      const percentage = total === 0 ? 0 : (above / total) * 100;

      return {
        total,
        above,
        percentage,
        threshold,
        days: input.days,
      };
    }),

  getHighScoreShareForCampaign: adminProcedure
    .input(
      z.object({
        campaignId: z.string().uuid(),
        days: z.number().min(1).max(90).default(30),
      })
    )
    .query(async ({ input, ctx }) => {
      const campaign = await ctx.db.campaign.findUnique({
        where: { id: input.campaignId },
        select: { autoArchiveScore: true },
      });

      const threshold = campaign?.autoArchiveScore ?? 75;

      const since = new Date();
      since.setDate(since.getDate() - input.days);

      const evaluations = await ctx.db.redditPostEvaluation.findMany({
        where: {
          campaignId: input.campaignId,
          createdAt: { gte: since },
        },
        select: {
          score: true,
          redditPost: {
            select: {
              subreddit: true,
            },
          },
        },
      });

      const counts = new Map<
        string,
        {
          total: number;
          above: number;
        }
      >();

      for (const evalRow of evaluations) {
        const subreddit = evalRow.redditPost.subreddit;
        const current = counts.get(subreddit) ?? { total: 0, above: 0 };
        current.total += 1;
        if (evalRow.score >= threshold) current.above += 1;
        counts.set(subreddit, current);
      }

      const result = Array.from(counts.entries()).map(
        ([subreddit, { total, above }]) => {
          const percentage = total === 0 ? 0 : (above / total) * 100;
          return {
            subreddit,
            total,
            above,
            percentage,
            threshold,
          };
        }
      );

      return {
        days: input.days,
        threshold,
        items: result,
      };
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
          // greater than 2 days ago, using date-fns
          createdUtc: {
            gte: subDays(new Date(), 2),
          },
        },
        orderBy: { createdUtc: "desc" },
      });

      if (posts.length === 0) return { ok: true, evaluated: 0 };

      for (let i = 0; i < posts.length; i++) {
        const p = posts[i]!;
        await enqueueTask(TASK_NAMES.reddit.scoreRedditPost, {
          postId: p.redditId,
          campaignId: input.campaignId,
        });
        // Spread evaluation jobs out in time to avoid hitting provider rate limits.
        if (i < posts.length - 1) {
          await new Promise((resolve) =>
            setTimeout(resolve, EVAL_QUEUE_DELAY_MS)
          );
        }
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
          model: true,
        },
      });

      if (!campaign) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Campaign not found: ${input.campaignId}`,
        });
      }

      // ---- SHARED PROMPT BASE ----

      const scoringPromptHeader = [
        "ROLE: You are an expert community + SEO strategist.",
        "Primary job: Decide whether this post is a GOOD or BAD place to engage. It is OK, and EXPECTED, that many posts will be bad fits.",
        "",
        `BUSINESS DESCRIPTION: ${campaign.description}`,
        `BRAND NAME: ${campaign.name}`,
        "",
        "GOAL: Score how promising it is to post a *non-spammy*, genuinely helpful reply that only mentions the brand if it feels natural and clearly useful for the original poster.",
        "",
        "IMPORTANT RULES:",
        "- If the only way to mention the brand would feel forced, off-topic, or salesy, give a LOW score (≤ 20) and shouldReply = false.",
        "- If the post is a meme/vent/drama or not looking for help or recommendations, give a LOW score (≤ 20) and shouldReply = false.",
        "- It is better to miss an opportunity than to spam.",
        "",
        "SCORING (1–100):",
        "80–100: Very strong fit. The post clearly asks for help/info that the business can genuinely solve. A natural, useful reply is obvious.",
        "60–79: Decent fit. There is a reasonable, non-spammy angle where the business can help, but it’s not perfect.",
        "30–59: Weak fit. Only a subtle or partial connection; replying might be okay but not a priority.",
        "1–29: Bad fit. No good way to add value; any mention would feel like spam or off-topic.",
        "",
        "Consider:",
        "- Relevance to the business description.",
        "- Explicit need/pain ('how do I', 'tools for…', 'recommend', 'any tips', 'looking for') vs. broad discussion or rant.",
        "- Post type: questions/requests > thoughtful discussions > venting/drama > memes/shitposts.",
        "- Recency & engagement (score/comments) as visibility signals.",
        "- Whether you can clearly imagine a helpful, *non-salesy* reply. If not, score low and shouldReply = false.",
      ].join("\n");

      // Find the post
      const post = await ctx.db.redditPost.findFirst({
        where: {
          redditId: input.postId,
        },
      });

      if (!post) return { ok: true, evaluated: 0 };

      // ---- PINNED EXAMPLES ----

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

      const pinnedPositiveExamplesSection =
        pinnedPositiveExamples.length > 0
          ? [
              "Pinned positive examples for campaign context:",
              "Use these samples to understand the campaign's preferred tone, value angle, and what counts as a GOOD fit.",
              ...pinnedPositiveExamples.map((example, index) => {
                const postTitle = example.redditPost.title ?? "Untitled post";
                const snippet = `
              --- Sample ${index + 1} (POSITIVE) ---
              Posted Title: ${postTitle}
              Score: ${example.score}
              Example Message: ${example.exampleMessage?.trim() || "(none)"}
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
              "Use these samples to understand what the campaign considers BAD fits. Avoid giving similar posts high scores.",
              ...pinnedNegativeExamples.map((example, index) => {
                const postTitle = example.redditPost.title ?? "Untitled post";
                const snippet = `
              --- Sample ${index + 1} (NEGATIVE) ---
              Posted Title: ${postTitle}
              Score: ${example.score}
              Example Message: ${example.exampleMessage?.trim() || "(none)"}
              Reasoning: ${example.reasoning?.trim()}
              User Feedback: ${example.rating}
              `.trim();
                return snippet;
              }),
            ].join("\n\n")
          : "";

      // Optional global seeds if no campaign-specific examples
      const shouldInjectGlobalSeeds =
        pinnedPositiveExamples.length === 0 &&
        pinnedNegativeExamples.length === 0;

      const globalSeedExamplesSection = shouldInjectGlobalSeeds
        ? [
            "Global examples to calibrate scoring:",
            "",
            "--- Example A (GOOD FIT) ---",
            "Post: 'Any tools to automate reporting for my small ecommerce store?'",
            "Reasoning: Directly aligned with an analytics/automation product; user explicitly asks for tools.",
            "Score: 90, shouldReply: true",
            "",
            "--- Example B (BAD FIT) ---",
            "Post: 'LOL look at this meme about my boss 😂'",
            "Reasoning: Meme/vent; not asking for help or recommendations. Any brand reply would look like spam.",
            "Score: 5, shouldReply: false",
          ].join("\n")
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

        // ---- MODEL SELECTION ----

        const defaultModel = "openai/gpt-4o-mini";
        const modelId = campaign.model ?? defaultModel;
        const model = openrouter.languageModel(
          modelId
        ) as unknown as LanguageModel;

        // =========================================
        // STEP 1: SCORING + SHOULD_REPLY + ANGLE
        // =========================================

        const scoringSchema = z.object({
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
          shouldReply: z
            .boolean()
            .describe(
              "True only if replying would clearly add value and not be spammy."
            ),
          replyAngle: z
            .enum([
              "NONE",
              "QUESTION_HELP",
              "RECOMMENDATION",
              "DISCUSSION",
              "OFF_TOPIC",
            ])
            .describe(
              "High-level category for how we would reply. Use NONE if shouldReply is false."
            ),
        });

        const scoringPrompt = [
          scoringPromptHeader,
          globalSeedExamplesSection,
          pinnedPositiveExamplesSection,
          pinnedNegativeExamplesSection,
          "",
          "OUTPUT FORMAT:",
          "Return ONLY JSON with { score, reasoning, shouldReply, replyAngle }.",
          "If replying would be spammy or off-topic, set shouldReply = false and replyAngle = 'NONE'.",
          "",
          "--- REDDIT POST TO EVALUATE ---",
          details,
          "--------------------------------",
        ]
          .filter(Boolean)
          .join("\n\n");

        const scoringResult = await generateObject({
          model,
          schema: scoringSchema,
          prompt: scoringPrompt,
        });

        const raw = scoringResult.object;

        const score = Math.max(1, Math.min(100, Math.round(raw.score)));
        const reasoning = String(raw.reasoning || "").slice(0, 4000);
        const shouldReply = !!raw.shouldReply;
        const replyAngle = raw.replyAngle || "NONE";

        // ---- THRESHOLDS ----
        // Archive threshold is driven by campaign.autoArchiveScore.
        const archiveThreshold = campaign.autoArchiveScore ?? 60;
        const shouldArchive =
          campaign.autoArchiveScore != null && score < archiveThreshold;

        // Reply threshold is independent: any score >= this will get an exampleMessage.
        // You can make this configurable later via a DB column.
        const shouldDraft = score >= archiveThreshold;

        // =========================================
        // STEP 2: DRAFT REPLY (ONLY IF SCORE HIGH)
        // =========================================

        let exampleMessage = "";

        if (shouldDraft) {
          const draftingSchema = z.object({
            exampleMessage: z
              .string()
              .min(3)
              .describe(
                "A helpful, non-spammy reply suitable for Reddit. Mention the brand only if it feels natural and useful."
              ),
          });

          const draftingPrompt = [
            "ROLE: You are writing a helpful, non-spammy Reddit reply.",
            `BUSINESS: ${campaign.name} – ${campaign.description}`,
            "GOAL: Write a reply that genuinely helps the OP first. Mention the brand only if it feels natural and clearly useful.",
            "",
            "RULES:",
            "- Do NOT hard sell.",
            "- No urgency or FOMO.",
            "- If a link is relevant, include it only once, ideally at the end.",
            "- Fit the tone of Reddit: conversational, honest, not corporate-y.",
            "",
            `REPLY ANGLE: ${replyAngle}`,
            `MODEL SHOULD_REPLY FLAG: ${shouldReply ? "true" : "false"} (informational only, do not override the score logic).`,
            "",
            "CONTEXT FROM SCORING STEP:",
            `Score: ${score}`,
            `Reasoning: ${reasoning}`,
            "",
            "--- REDDIT POST ---",
            details,
            "--------------------",
            "",
            "OUTPUT: Return ONLY JSON with { exampleMessage }.",
          ].join("\n\n");

          const draftingResult = await generateObject({
            model,
            schema: draftingSchema,
            prompt: draftingPrompt,
          });

          exampleMessage = String(
            draftingResult.object.exampleMessage || ""
          ).slice(0, 4000);
        } else {
          // For low-score posts, explicitly keep exampleMessage empty.
          exampleMessage = "";
        }

        // =========================================
        // UPSERT EVALUATION
        // =========================================

        await ctx.db.redditPostEvaluation.upsert({
          where: {
            redditPostId_campaignId: {
              redditPostId: post.id,
              campaignId: input.campaignId,
            },
          },
          create: {
            redditPostId: post.id,
            score,
            reasoning,
            modelName: modelId,
            exampleMessage,
            campaignId: input.campaignId,
            archived: shouldArchive,
          },
          update: {
            score,
            reasoning,
            modelName: modelId,
            exampleMessage,
            archived: shouldArchive,
          },
        });
      } catch (err) {
        console.error("[scoreRedditPosts] eval failed for", post?.id, err);
      }

      return { ok: true };
    }),

  bookmark: adminProcedure
    .input(
      z.object({
        evaluationId: z.string().uuid(),
        bookmarked: z.boolean(),
        exampleMessage: z.string().optional(),
        reasoning: z.string().optional(),
        score: z.number().min(1).max(100).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await ctx.db.redditPostEvaluation.update({
        where: { id: input.evaluationId },
        data: {
          bookmarked: input.bookmarked,
          exampleMessage: input.exampleMessage,
          reasoning: input.reasoning,
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
