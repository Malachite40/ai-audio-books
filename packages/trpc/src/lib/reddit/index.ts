import { createRedditClientFromEnv, RedditClient } from "./redditClient";

// Keep a single instance across hot reloads in dev, but refresh if shape changed
const globalForReddit = global as unknown as { reddit?: RedditClient };

let instance = globalForReddit.reddit;
// If no instance, or the instance is from a previous version without new methods, recreate
if (
  !instance ||
  typeof (instance as any).searchSubreddits !== "function" ||
  typeof (instance as any).searchSubredditsApi !== "function" ||
  typeof (instance as any).getSubredditRules !== "function" ||
  typeof (instance as any).getCommentsByPermalink !== "function" ||
  typeof (instance as any).getSimilarSubreddits !== "function"
) {
  instance = createRedditClientFromEnv();
  if (process.env.NODE_ENV !== "production") globalForReddit.reddit = instance;
}

export const reddit: RedditClient = instance;
