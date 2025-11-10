import { openai } from "@ai-sdk/openai";
import { Prisma, prisma } from "@workspace/database";
import { generateObject } from "ai";
import crypto from "crypto";
import z from "zod";
import { TASK_NAMES } from "../queue";
import { enqueueTask } from "../queue/enqueue";
import { adminProcedure, createTRPCRouter, queueProcedure } from "../trpc";

const Category = z.enum(["new", "hot", "rising", "top", "controversial"]);
type Category = z.infer<typeof Category>;

const scanSubredditInput = z.object({
  subreddit: z.string().min(1),
  category: Category,
});

export const redditRouter = createTRPCRouter({
  adminQueueScanSubreddit: adminProcedure
    .input(z.object({ subreddit: z.string().min(1) }))
    .mutation(async ({ input }) => {
      await queueScanSubreddit(input.subreddit);
      return { ok: true };
    }),
  scanWatchList: queueProcedure.mutation(async () => {
    await queueScanWatchList();
    return { ok: true };
  }),
  adminScanWatchList: adminProcedure.mutation(async () => {
    await queueScanWatchList();
    return { ok: true };
  }),
  scanSubreddit: queueProcedure
    .input(scanSubredditInput)
    .mutation(async ({ input }) => {
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

      const created = await prisma.redditPost.createMany({
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
      })
    )
    .query(async ({ input }) => {
      const where = {
        subreddit: input.subreddit ? { equals: input.subreddit } : undefined,
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
        prisma.redditPost.findMany({
          where,
          orderBy: { createdUtc: "desc" },
          skip: (input.page - 1) * input.pageSize,
          take: input.pageSize,
        }),
        prisma.redditPost.count({ where }),
      ]);

      return { items, total };
    }),
  listWatchList: adminProcedure.query(async () => {
    const items = await prisma.redditWatchList.findMany({
      orderBy: { subreddit: "asc" },
    });
    return { items };
  }),
  upsertWatchList: adminProcedure
    .input(z.object({ subreddit: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const item = await prisma.redditWatchList.upsert({
        where: { subreddit: input.subreddit },
        update: { updatedAt: new Date() },
        create: { subreddit: input.subreddit },
      });
      return { ok: true, item };
    }),
  deleteWatchList: adminProcedure
    .input(z.object({ subreddit: z.string().min(1) }))
    .mutation(async ({ input }) => {
      await prisma.redditWatchList.delete({
        where: { subreddit: input.subreddit },
      });
      return { ok: true };
    }),
  /**
   * Queue-only: evaluate unevaluated reddit posts with AI and persist a score/reasoning.
   * Idempotent via unique index on redditPostId.
   */
  scoreRedditPosts: queueProcedure
    .input(
      z
        .object({
          limit: z.number().min(1).max(50).default(10),
          minCreatedUtc: z.date().optional(),
          subreddit: z.string().optional(),
        })
        .optional()
    )
    .mutation(async ({ input }) => {
      const limit = input?.limit ?? 10;

      // Load evaluation prompt from KV, or use reasonable default
      const kv = await prisma.keyValueStore.findUnique({
        where: { key: "ai-eval-prompt" },
      });
      const defaultPrompt = `ROLE: You are an expert community + SEO strategist.
GOAL: Score how promising it is to post a helpful reply that naturally mentions and links to https://instantaudio.online to drive organic traffic.

SCORING (1–100): Higher is better. Consider:
- Relevance to text-to-speech, audio narration, creating audiobooks, or converting content to audio
- Explicit need/pain (“how do I”, “tools for…”, “recommend”) vs. broad discussion
- Post tone: questions/requests > debates > memes
- Recency and engagement (score/comments) as signal of visibility
- Clear angle to add value without being spammy; can suggest a free useful tip + link

OUTPUT: JSON with { score: 1-100, reasoning: string }. No extra keys.`;
      const basePrompt = (kv?.value ?? defaultPrompt).trim();

      // Find posts without an evaluation yet
      const posts = await prisma.redditPost.findMany({
        where: {
          evaluation: { is: null },
          subreddit: input?.subreddit ? { equals: input.subreddit } : undefined,
          createdUtc: input?.minCreatedUtc
            ? { gte: input.minCreatedUtc }
            : undefined,
        },
        orderBy: { createdUtc: "desc" },
        take: limit,
      });

      if (posts.length === 0) return { ok: true, evaluated: 0 };

      const model = openai("gpt-4o-mini");

      let evaluated = 0;
      for (const p of posts) {
        try {
          const details = [
            `Subreddit: r/${p.subreddit}`,
            `Category: ${p.category}`,
            `Title: ${p.title}`,
            p.selfText ? `SelfText: ${p.selfText}` : null,
            p.author ? `Author: ${p.author}` : null,
            p.score != null ? `Reddit Score: ${p.score}` : null,
            p.numComments != null ? `Comments: ${p.numComments}` : null,
            `Permalink: https://www.reddit.com${p.permalink}`,
            p.url ? `Linked URL: ${p.url}` : null,
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
            }),
            prompt: `${basePrompt}\n\n---
REDDIT POST
${details}\n---\nReturn only JSON.`,
          });

          const score = Math.max(1, Math.min(100, Math.round(object.score)));
          const reasoning = String(object.reasoning || "").slice(0, 4000);

          // Upsert to guard against race
          await prisma.redditPostEvaluation.create({
            data: {
              redditPostId: p.id,
              score,
              reasoning,
              modelName: "gpt-4o-mini",
            },
          });
          evaluated++;
        } catch (err) {
          // Skip failures; continue with others
          // Optional: log to console; cron stdout shows it
          console.error("[scoreRedditPosts] eval failed for", p.id, err);
        }
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
      })
    )
    .query(async ({ input }) => {
      const where = {
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
        prisma.redditPostEvaluation.findMany({
          where,
          orderBy: { createdAt: "desc" },
          include: { redditPost: true },
          skip: (input.page - 1) * input.pageSize,
          take: input.pageSize,
        }),
        prisma.redditPostEvaluation.count({ where }),
      ]);

      return { items, total };
    }),
});

async function queueScanWatchList() {
  const rows = await prisma.redditWatchList.findMany({
    select: { subreddit: true },
  });

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]!;
    await queueScanSubreddit(r.subreddit);
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
