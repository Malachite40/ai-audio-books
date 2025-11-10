// apps/cron/index.ts
import cron from "node-cron";
import { api } from "./trpc";

console.log("[cron] starting scheduler…");

// runs every 30 minutes
cron.schedule("*/30 * * * *", async () => {
  try {
    await api.reddit.scanWatchList();
  } catch (err) {
    console.error("[cron] job error:", err);
  }
});

// evaluate reddit posts every 30 minutes
cron.schedule("*/30 * * * *", async () => {
  try {
    await api.reddit.scoreRedditPosts({ limit: 10 });
  } catch (err) {
    console.error("[cron] scoreRedditPosts error:", err);
  }
});
