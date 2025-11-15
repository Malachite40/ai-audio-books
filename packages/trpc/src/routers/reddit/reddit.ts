import crypto from "crypto";
import z from "zod";
import { reddit } from "../../lib/reddit";
import { adminProcedure, createTRPCRouter, queueProcedure } from "../../trpc";
import { campaignsRouter } from "./campaign";
import { evaluationsRouter } from "./evaluations";
import { postRouter } from "./post";
import { queueScanSubreddit } from "./queueScan";
import { Category, scanSubredditInput } from "./types";

export const redditRouter = createTRPCRouter({
  campaigns: campaignsRouter,
  evaluations: evaluationsRouter,
  posts: postRouter,
  search: adminProcedure
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
  searchApi: adminProcedure
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
  getRules: adminProcedure
    .input(z.object({ subreddit: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const data = await reddit.getSubredditRules(input.subreddit);
      return data;
    }),
  getSimilar: adminProcedure
    .input(
      z.object({
        subreddit: z.string().min(1),
        limit: z.number().min(1).max(100).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const items = await reddit.getSimilarSubreddits(input.subreddit, {
        limit: input.limit ?? 25,
      });
      return { items };
    }),

  adminQueueScan: adminProcedure
    .input(z.object({ subreddit: z.string().min(1) }))
    .mutation(async ({ input }) => {
      await queueScanSubreddit(input.subreddit);
      return { ok: true };
    }),
  scan: queueProcedure
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
  upsert: adminProcedure
    .input(
      z.object({
        subreddit: z.string().min(1),
        campaignId: z.string(),
        reach: z.number().min(0).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      let reach = input.reach ?? null;

      if (!reach) {
        const subreddit = await reddit.getSubreddit(input.subreddit).getInfo();
        reach = subreddit?.subscribers ?? null;
      }

      const item = await ctx.db.watchedSubreddit.upsert({
        where: {
          campaignId_subreddit: {
            campaignId: input.campaignId,
            subreddit: input.subreddit,
          },
        },
        update: { updatedAt: new Date(), reach },
        create: {
          subreddit: input.subreddit,
          campaignId: input.campaignId,
          reach,
        },
      });
      return { ok: true, item };
    }),
  delete: adminProcedure
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
  fetchAll: adminProcedure
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
});
