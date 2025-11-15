// apps/cron/index.ts
import cron from "node-cron";
import { api } from "./trpc";

console.log("[cron] starting scheduler…");

// runs every 30 minutes
cron.schedule("*/30 * * * *", async () => {
  try {
    console.log("[cron] running subreddit scan job…");
    await api.reddit.campaigns.scan();
  } catch (err) {
    console.error("[cron] job error:", err);
  }
});

// runs every 30 minutes
cron.schedule("*/30 * * * *", async () => {
  try {
    console.log("[cron] running queue all posts to score job…");
    await api.reddit.campaigns.queueAllPostsToScore();
  } catch (err) {
    console.error("[cron] job error:", err);
  }
});
