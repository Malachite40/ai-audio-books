import {
  RedditDigestEmail,
  SubscriptionActivatedEmail,
  WelcomeEmail,
} from "@workspace/transactional";
import z from "zod";
import { resend } from "../../lib/resend";
import { TASK_NAMES } from "../../queue";
import { enqueueTask } from "../../queue/enqueue";
import {
  adminProcedure,
  createTRPCRouter,
  publicProcedure,
  queueProcedure,
} from "../../trpc";
export const emailsRouter = createTRPCRouter({
  join: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
        group: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const emailLower = input.email.toLowerCase();

      await ctx.db.emails.upsert({
        where: { email_group: { email: emailLower, group: input.group } },
        update: { group: input.group.toLowerCase() },
        create: { email: emailLower, group: input.group.toLowerCase() },
      });

      await resend.emails.send({
        from: "Instant Audio Online <support@instantaudio.online>",
        to: [input.email],
        subject: "Welcome to Instant Audio Online!",
        react: WelcomeEmail({}),
      });

      return {};
    }),
  check: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const existingEmail = await ctx.db.emails.findFirst({
        where: {
          email: {
            mode: "insensitive",
            equals: input.email.toLowerCase(),
          },
        },
      });
      if (existingEmail) return { subscribed: true };

      return {
        subscribed: false,
      };
    }),

  subscribe: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        await resend.emails.send({
          from: "Instant Audio Online <support@instantaudio.online>",
          to: [input.email],
          subject: "You're now subscribed!",
          react: SubscriptionActivatedEmail({}),
        });
      } catch (e) {
        console.error("Failed to send subscription activation email:", e);
      }
    }),

  queueRedditDailyDigestForAllActiveCampaigns: queueProcedure
    .input(
      z
        .object({
          minScore: z.number().min(1).max(100).default(75),
          hoursBack: z.number().min(1).max(72).default(24),
        })
        .optional()
        .default({})
    )
    .mutation(async ({ ctx, input }) => {
      const campaigns = await ctx.db.campaign.findMany({
        where: { isActive: true },
        select: { id: true },
      });

      for (const campaign of campaigns) {
        await enqueueTask(TASK_NAMES.email.sendRedditDailyDigestForAdmin, {
          campaignId: campaign.id,
          minScore: input.minScore,
          hoursBack: input.hoursBack,
        });
      }

      return { ok: true, queued: campaigns.length };
    }),

  adminQueueRedditDailyDigestForCampaign: adminProcedure
    .input(
      z.object({
        campaignId: z.string().uuid(),
        minScore: z.number().min(1).max(100).default(75),
        hoursBack: z.number().min(1).max(72).default(24),
      })
    )
    .mutation(async ({ input }) => {
      await enqueueTask(TASK_NAMES.email.sendRedditDailyDigestForAdmin, {
        campaignId: input.campaignId,
        minScore: input.minScore,
        hoursBack: input.hoursBack,
      });
      return { ok: true };
    }),

  sendRedditDailyDigestForAdmin: queueProcedure
    .input(
      z.object({
        campaignId: z.string().uuid(),
        minScore: z.number().min(1).max(100).default(75),
        hoursBack: z.number().min(1).max(72).default(24),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const now = new Date();
      const since = new Date(now);
      since.setHours(now.getHours() - input.hoursBack);

      const campaign = await ctx.db.campaign.findUnique({
        where: { id: input.campaignId },
      });

      if (!campaign) {
        console.error(
          `[emails.sendRedditDailyDigestForAdmin] Campaign not found: ${input.campaignId}`
        );
        return { ok: false, sent: false, count: 0 };
      }

      const evaluations = await ctx.db.redditPostEvaluation.findMany({
        where: {
          archived: false,
          createdAt: { gte: since },
          campaignId: input.campaignId,
        },
        include: {
          redditPost: true,
          campaign: true,
        },
        orderBy: [{ createdAt: "desc" }],
      });

      if (evaluations.length === 0) {
        console.log(
          "[emails.sendRedditDailyDigestForAdmin] No evaluations found for window, skipping email."
        );
        return { ok: true, sent: false, count: 0 };
      }

      // Determine threshold from the campaign if configured, otherwise default to 75.
      let threshold = campaign?.autoArchiveScore ?? 75;

      // Aggregate success rates per subreddit for this window.
      const bySubreddit = new Map<
        string,
        { total: number; aboveThreshold: number }
      >();

      for (const ev of evaluations) {
        const subreddit = ev.redditPost?.subreddit ?? "unknown";
        const entry = bySubreddit.get(subreddit) ?? {
          total: 0,
          aboveThreshold: 0,
        };
        entry.total += 1;
        if (ev.score >= threshold) {
          entry.aboveThreshold += 1;
        }
        bySubreddit.set(subreddit, entry);
      }

      const subredditStats = Array.from(bySubreddit.entries())
        .map(([subreddit, { total, aboveThreshold }]) => ({
          subreddit,
          total,
          aboveThreshold,
          successRate:
            total > 0 ? Math.round((aboveThreshold / total) * 100) : 0,
        }))
        // Sort by success rate, then by total volume.
        .sort((a, b) => {
          if (b.successRate !== a.successRate) {
            return b.successRate - a.successRate;
          }
          return b.total - a.total;
        });

      // Build list of top posts above the configured minScore, limited for readability.
      const posts = evaluations
        .filter((ev) => ev.score >= input.minScore)
        .sort((a, b) => {
          if (b.score !== a.score) return b.score - a.score;
          return b.createdAt.getTime() - a.createdAt.getTime();
        })
        .slice(0, 3)
        .map((ev) => {
          const post = ev.redditPost;
          if (!post) return null;

          const permalinkUrl = post.permalink
            ? `https://www.reddit.com${post.permalink}`
            : undefined;

          return {
            id: ev.id,
            title: post.title,
            subreddit: post.subreddit,
            url: permalinkUrl ?? post.url ?? undefined,
            score: ev.score,
            reasoning: ev.reasoning,
            exampleMessage: ev.exampleMessage ?? undefined,
            createdAt: ev.createdAt,
          };
        })
        .filter((p): p is NonNullable<typeof p> => p != null);

      await resend.emails.send({
        from: "Instant Audio Online <support@instantaudio.online>",
        to: ["dylancronkhite1@gmail.com"],
        subject: "Reddit content opportunities for today",
        react: RedditDigestEmail({
          posts,
          windowHours: input.hoursBack,
          minScore: input.minScore,
          campaignPath: input.campaignId
            ? `/campaign/${input.campaignId}`
            : undefined,
          summary: {
            threshold,
            totalRecentUnarchived: evaluations.length,
            subredditStats,
          },
        }),
      });

      return { ok: true, sent: true, count: posts.length };
    }),
});
