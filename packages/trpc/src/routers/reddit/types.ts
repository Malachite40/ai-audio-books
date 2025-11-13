import z from "zod";

export const Category = z.enum([
  "new",
  "hot",
  "rising",
  "top",
  "controversial",
]);
export type Category = z.infer<typeof Category>;

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
