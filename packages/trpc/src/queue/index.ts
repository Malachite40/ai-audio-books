const TASK_NAMES = {
  processAudioChunk: "tasks.processAudioChunk",
  processAudioChunkWithInworld: "tasks.processAudioChunkWithInworld",
  processAudioFile: "tasks.processAudioFile",
  concatAudioFile: "tasks.concatAudioFile",
  createAudioFileChunks: "tasks.createAudioFileChunks",
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
  },
} as const;

export { TASK_NAMES };
