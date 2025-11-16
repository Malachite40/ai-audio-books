const TASK_NAMES = {
  processAudioChunk: "tasks.processAudioChunk",
  processAudioChunkWithInworld: "tasks.processAudioChunkWithInworld",
  processAudioFile: "tasks.processAudioFile",
  concatAudioFile: "tasks.concatAudioFile",
  createAudioFileChunks: "tasks.createAudioFileChunks",
  createAudioFileChunksFromChapters: "tasks.createAudioFileChunksFromChapters",
  redditScanSubreddit: "reddit.scanSubreddit",
  redditBackfillSubreddit: "reddit.backfillSubreddit30Days",
  scoreRedditPosts: "tasks.scoreRedditPosts",
  scoreRedditPost: "tasks.scoreRedditPost",
  queueAllPostsToScore: "tasks.queueAllPostsToScore",
  sendRedditDailyDigestForAdmin: "tasks.sendRedditDailyDigestForAdmin",
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

export { TASK_NAMES };
