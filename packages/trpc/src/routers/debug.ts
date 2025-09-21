import { TASK_NAMES } from "../queue";
import { client } from "../queue/client";
import { adminProcedure, createTRPCRouter, publicProcedure } from "../trpc";

export const debugRouter = createTRPCRouter({
  queueHeapSnapshot: adminProcedure.mutation(async () => {
    const task = client.createTask(TASK_NAMES.test.heapSnapShot);
    const result = task.applyAsync([]);
    const value = await result.get();
    return value;
  }),
  heapSnapshot: publicProcedure.mutation(async () => {
    const m = process.memoryUsage();
    console.log(m);

    return {
      rssMB: (m.rss / 1e6).toFixed(1),
      heapUsedMB: (m.heapUsed / 1e6).toFixed(1),
      heapTotalMB: (m.heapTotal / 1e6).toFixed(1),
      externalMB: (m.external / 1e6).toFixed(1),
      arrayBuffersMB: (m.arrayBuffers / 1e6).toFixed(1),
      raw: m, // optional: include the raw Node.js values (bytes)
    };
  }),
});
