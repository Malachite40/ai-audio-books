import { SendRedditDailyDigestForAdminInput } from "../routers/email/types";
import type {
  Backfill30DaysInput,
  ScanSubredditInput,
  ScoreRedditPostInput,
  ScoreRedditPostsInput,
} from "../routers/reddit/types";
import type {
  TestAudioChunkInput,
  TestConcatAudioFileInput,
} from "../routers/testWorkers";
import type {
  AudioChunkInput,
  ConcatAudioFileInput,
  CreateAudioFileChunksFromChaptersInput,
  CreateAudioFileChunksInput,
  ProcessAudioFileInput,
} from "../routers/workers";
import type {
  GenerateImageInput,
  GenerateStoryInput,
} from "../routers/workers/ai";

export const TASK_NAMES = {
  audio: {
    processAudioChunk: "tasks.processAudioChunk",
    processAudioChunkWithInworld: "tasks.processAudioChunkWithInworld",
    processAudioFile: "tasks.processAudioFile",
    concatAudioFile: "tasks.concatAudioFile",
    createAudioFileChunks: "tasks.createAudioFileChunks",
    createAudioFileChunksFromChapters:
      "tasks.createAudioFileChunksFromChapters",
  },
  campaign: {
    queueAllPostsToScore: "tasks.campaign.queueAllPostsToScore",
  },
  reddit: {
    redditScanSubreddit: "reddit.scanSubreddit",
    redditBackfillSubreddit: "reddit.backfillSubreddit30Days",
    scoreRedditPosts: "tasks.scoreRedditPosts",
    scoreRedditPost: "tasks.scoreRedditPost",
  },
  email: {
    sendRedditDailyDigestForAdmin: "tasks.sendRedditDailyDigestForAdmin",
  },
  ai: {
    generateStory: "tasks.ai.generateStory",
    generateImage: "tasks.ai.generateImage",
  },
  test: {
    processTestAudioChunk: "tasks.test.processTestAudioChunk",
    concatTestAudioFile: "tasks.test.concatTestAudioFile",
    createAudioFileTest: "tasks.test.createAudioFileTest",
    processTestAudioFile: "tasks.test.processTestAudioFile",
    heapSnapShot: "tasks.test.heapSnapShot",
    garbageCleanup: "tasks.test.garbageCleanup",
    memoryHogAlloc: "tasks.test.memoryHogAlloc",
    memoryHogFree: "tasks.test.memoryHogFree",
  },
} as const;

// One source of truth for task names & payloads
export interface TaskMap {
  [TASK_NAMES.audio.processAudioChunk]: AudioChunkInput;
  [TASK_NAMES.audio.processAudioChunkWithInworld]: AudioChunkInput;
  [TASK_NAMES.audio.processAudioFile]: ProcessAudioFileInput;
  [TASK_NAMES.audio.concatAudioFile]: ConcatAudioFileInput;
  [TASK_NAMES.audio.createAudioFileChunks]: CreateAudioFileChunksInput;
  [TASK_NAMES.audio
    .createAudioFileChunksFromChapters]: CreateAudioFileChunksFromChaptersInput;

  [TASK_NAMES.campaign.queueAllPostsToScore]: void;

  [TASK_NAMES.reddit.redditScanSubreddit]: ScanSubredditInput;
  [TASK_NAMES.reddit.redditBackfillSubreddit]: Backfill30DaysInput;
  [TASK_NAMES.reddit.scoreRedditPosts]: ScoreRedditPostsInput;
  [TASK_NAMES.reddit.scoreRedditPost]: ScoreRedditPostInput;
  [TASK_NAMES.email
    .sendRedditDailyDigestForAdmin]: SendRedditDailyDigestForAdminInput;

  [TASK_NAMES.ai.generateStory]: GenerateStoryInput;
  [TASK_NAMES.ai.generateImage]: GenerateImageInput;

  [TASK_NAMES.test.processTestAudioChunk]: TestAudioChunkInput;
  [TASK_NAMES.test.concatTestAudioFile]: TestConcatAudioFileInput;
  [TASK_NAMES.test.createAudioFileTest]: unknown;
  [TASK_NAMES.test.processTestAudioFile]: TestConcatAudioFileInput;
  [TASK_NAMES.test.heapSnapShot]: void;
  [TASK_NAMES.test.garbageCleanup]: void;
  [TASK_NAMES.test.memoryHogAlloc]: { mb: number };
  [TASK_NAMES.test.memoryHogFree]: void;
}

export type TaskName = keyof TaskMap;
export type TaskPayload<N extends TaskName> = TaskMap[N];

// Helper to extract nested leaf values from TASK_NAMES
type LeafValues<T> = T extends string
  ? T
  : T extends Record<string, any>
    ? LeafValues<T[keyof T]>
    : never;

export type TaskNamesTree = typeof TASK_NAMES;
export type AllTaskNamesFromTree = LeafValues<TaskNamesTree>;
