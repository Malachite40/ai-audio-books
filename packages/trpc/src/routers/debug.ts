import { readFile } from "node:fs/promises";
import * as v8 from "v8";
import { TASK_NAMES } from "../queue";
import { client } from "../queue/client";
import { adminProcedure, createTRPCRouter, publicProcedure } from "../trpc";

async function readProc(path: string) {
  try {
    return await readFile(path, "utf8");
  } catch {
    return null;
  }
}
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
  heapSanity: publicProcedure.mutation(async () => {
    const mem = process.memoryUsage();
    const rep = (v8 as any).getHeapStatistics?.() ?? null;
    const spaces = (v8 as any).getHeapSpaceStatistics?.() ?? null;
    const ru = process.resourceUsage?.() ?? null;

    // Linux OS-level truths (if available)
    const status = await readProc("/proc/self/status"); // includes VmRSS, VmSize
    const statm = await readProc("/proc/self/statm"); // pages
    const cgroup =
      (await readProc("/sys/fs/cgroup/memory.current")) ??
      (await readProc("/sys/fs/cgroup/memory/memory.usage_in_bytes"));

    return {
      runtime: process.release?.name ?? "unknown",
      versions: process.versions,
      pid: process.pid,

      // JS-level
      processMemoryUsage: mem,

      // V8-level (Node authoritative)
      v8HeapStatistics: rep,
      v8HeapSpaces: spaces,

      // OS-level
      resourceUsage: ru, // ru.maxRSS etc.
      procStatus: status, // raw text
      procStatm: statm, // raw text
      cgroupMemoryCurrent: cgroup, // raw text (bytes)

      // convenience MB (decimal)
      computed: {
        rssMB: +(mem.rss / 1e6).toFixed(1),
        heapUsedMB: +(mem.heapUsed / 1e6).toFixed(1),
        heapTotalMB: +(mem.heapTotal / 1e6).toFixed(1),
        externalMB: +(mem.external / 1e6).toFixed(1),
        arrayBuffersMB: +(mem.arrayBuffers / 1e6).toFixed(1),
        v8_usedMB: rep ? +(rep.used_heap_size / 1e6).toFixed(1) : null,
        v8_totalMB: rep ? +(rep.total_heap_size / 1e6).toFixed(1) : null,
        v8_limitMB: rep ? +(rep.heap_size_limit / 1e6).toFixed(1) : null,
      },
    };
  }),
});
