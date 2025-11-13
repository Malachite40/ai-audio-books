import dotenv from "dotenv";
dotenv.config({ path: ".env" });

import { TASK_NAMES } from "@workspace/trpc/server";
import { createWorker } from "celery-node";
import { api } from "./src/trpc";

const worker = createWorker(process.env.BROKER, process.env.REDIS_URL);

// ─────────────────────────────────────────────────────────────────────────────
// Register Test Worker Tasks
// ─────────────────────────────────────────────────────────────────────────────
worker.register(
  TASK_NAMES.test.processTestAudioChunk,
  api.workers.test.processAudioChunk
);
worker.register(
  TASK_NAMES.test.concatTestAudioFile,
  api.workers.test.concatTestAudioFile
);
worker.register(
  TASK_NAMES.test.processTestAudioFile,
  api.workers.test.processTestAudioFile
);
worker.register(TASK_NAMES.test.heapSnapShot, api.debug.heapSnapshot);
worker.register(TASK_NAMES.test.garbageCleanup, api.debug.garbageCleanup);
worker.register(TASK_NAMES.test.memoryHogAlloc, api.debug.memoryHogAlloc);

// ─────────────────────────────────────────────────────────────────────────────
// Register Main Worker Tasks
// ─────────────────────────────────────────────────────────────────────────────
worker.register(
  TASK_NAMES.processAudioChunkWithInworld,
  api.workers.processAudioChunkWithInworld
);
worker.register(TASK_NAMES.processAudioFile, api.workers.processAudioFile);
worker.register(TASK_NAMES.concatAudioFile, api.workers.concatAudioFile);
worker.register(
  TASK_NAMES.createAudioFileChunks,
  api.workers.createAudioFileChunks
);
worker.register(
  TASK_NAMES.createAudioFileChunksFromChapters,
  api.workers.createAudioFileChunksFromChapters
);

// ─────────────────────────────────────────────────────────────────────────────
// Register Reddit Worker Tasks
// ─────────────────────────────────────────────────────────────────────────────
worker.register(
  TASK_NAMES.redditScanSubreddit,
  api.reddit.scanSubredditWithSdk
);
worker.register(TASK_NAMES.scoreRedditPosts, api.reddit.scoreRedditPosts);
worker.register(TASK_NAMES.scoreRedditPost, api.reddit.scoreRedditPost);
worker.register(
  TASK_NAMES.queueAllPostsToScore,
  api.reddit.campaigns.queueAllPostsToScore
);

// ─────────────────────────────────────────────────────────────────────────────
// Register AI Worker Tasks
// ─────────────────────────────────────────────────────────────────────────────
worker.register(TASK_NAMES.ai.generateStory, api.workers.ai.generateStory);
worker.register(TASK_NAMES.ai.generateImage, api.workers.ai.generateImage);

// ─────────────────────────────────────────────────────────────────────────────
// Start Worker
// ─────────────────────────────────────────────────────────────────────────────
// Configure the worker to run only 3 tasks concurrently
worker.start();
