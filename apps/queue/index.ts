import dotenv from "dotenv";
dotenv.config({ path: ".env" });

import { TASK_NAMES } from "@workspace/trpc/server";
import { createWorker } from "celery-node";
import { api } from "./src/trpc";

const worker = createWorker(process.env.BROKER, process.env.REDIS_URL);

worker.register(TASK_NAMES.processAudioChunk, api.workers.processAudioChunk);
worker.register(
  TASK_NAMES.processAudioChunkWithInworld,
  api.workers.processAudioChunkWithInworld
);
worker.register(TASK_NAMES.processAudioFile, api.workers.processAudioFile);

// Configure the worker to run only 3 tasks concurrently
worker.start();
