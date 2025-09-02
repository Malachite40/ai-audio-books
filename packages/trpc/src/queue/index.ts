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
} as const;

export { TASK_NAMES };
