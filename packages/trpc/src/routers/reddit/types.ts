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
