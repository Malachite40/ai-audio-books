import { prisma } from "@workspace/database";
import { TASK_NAMES } from "../../queue";
import { enqueueTask } from "../../queue/enqueue";
import { QUEUE_DELAY_MS, TRACKED_CATEGORIES } from "./types";

export async function queueScanWatchedSubreddits({
  campaignId,
}: {
  campaignId?: string;
}) {
  const watchedSubreddits = await prisma.watchedSubreddit.findMany({
    where: campaignId ? { campaignId } : undefined,
    select: { subreddit: true },
  });

  const deduped = new Set<string>();
  watchedSubreddits.forEach((r) => deduped.add(r.subreddit));

  const dedupedArray = Array.from(deduped);
  for (let i = 0; i < dedupedArray.length; i++) {
    await queueScanSubreddit(dedupedArray[i]!);
    // Throttle to avoid Reddit rate limits
    await new Promise((resolve) => setTimeout(resolve, QUEUE_DELAY_MS));
  }
}

export async function queueScanSubreddit(subreddit: string) {
  await Promise.all(
    TRACKED_CATEGORIES.map((category) =>
      enqueueTask(TASK_NAMES.reddit.redditScanSubreddit, {
        subreddit,
        category,
      })
    )
  );
}
