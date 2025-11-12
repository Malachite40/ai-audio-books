import { createRedditClientFromEnv, RedditClient } from "./redditClient";

// Keep a single instance across hot reloads in dev
const globalForReddit = global as unknown as { reddit?: RedditClient };

export const reddit: RedditClient =
  globalForReddit.reddit ?? createRedditClientFromEnv();

if (process.env.NODE_ENV !== "production") globalForReddit.reddit = reddit;
