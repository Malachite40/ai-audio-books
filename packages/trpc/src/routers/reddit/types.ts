import z from "zod";

export const Category = z.enum([
  "new",
  "hot",
  "rising",
  "top",
  "controversial",
]);
export type Category = z.infer<typeof Category>;

export const TRACKED_CATEGORIES: Category[] = ["hot", "rising"];

export const CRON_INTERVAL_IN_MIN = 30;
export const MS_IN_30_MINUTES = 1000 * 60 * 30;
export const MAX_REQUESTS_PER_MINUTE = 100;
export const PADDING_MS = 20;
export const QUEUE_DELAY_MS =
  MS_IN_30_MINUTES / (MAX_REQUESTS_PER_MINUTE * CRON_INTERVAL_IN_MIN) +
  PADDING_MS; // Spread out over 30 minutes

// Evaluation rate limiting (OpenAI, etc.)
// Keep separate from Reddit HTTP scan limits so we can tune independently.
export const EVAL_MAX_REQUESTS_PER_MINUTE = 200;
export const EVAL_PADDING_MS = 10;
export const EVAL_QUEUE_DELAY_MS =
  60_000 / EVAL_MAX_REQUESTS_PER_MINUTE + EVAL_PADDING_MS;

// Safety cap for how many posts to schedule per batch for a campaign.
export const EVAL_MAX_PER_BATCH = 50;

// Safety cap for how many evaluations to create per campaign per day.
export const EVAL_MAX_PER_CAMPAIGN_PER_DAY = 500;

export const scanSubredditInput = z.object({
  subreddit: z.string().min(1),
  category: Category,
});

export const scoreRedditPostsInput = z.object({
  subreddit: z.string().optional(),
  campaignId: z.string().uuid(),
});

export const scoreRedditPostInput = z.object({
  postId: z.string().min(1),
  campaignId: z.string().uuid(),
});

export const backfill30DaysInput = z.object({ subreddit: z.string().min(1) });

export type ScanSubredditInput = z.infer<typeof scanSubredditInput>;
export type ScoreRedditPostsInput = z.infer<typeof scoreRedditPostsInput>;
export type ScoreRedditPostInput = z.infer<typeof scoreRedditPostInput>;
export type Backfill30DaysInput = z.infer<typeof backfill30DaysInput>;
