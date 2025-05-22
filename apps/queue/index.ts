import dotenv from "dotenv";
dotenv.config({ path: ".env" });

import { createWorker } from "celery-node";
import { api } from "./src/trpc";

const worker = createWorker(process.env.BROKER, process.env.REDIS_URL);

worker.register("tasks.processAudioChunk", api.workers.processAudioChunk);

worker.start();
