import { readFile } from "node:fs/promises";
import * as v8 from "v8";
import z from "zod";
import { TASK_NAMES } from "../queue";
import { client } from "../queue/client";
import {
  adminProcedure,
  createTRPCRouter,
  publicProcedure,
  queueProcedure,
} from "../trpc";

async function readProc(path: string) {
  try {
    return await readFile(path, "utf8");
  } catch {
    return null;
  }
}
// Module-level store for memory hog allocations
const memoryHogStore: { holder: unknown[]; allocatedMB: number } = {
  holder: [],
  allocatedMB: 0,
};
export const debugRouter = createTRPCRouter({
  queueHeapSnapshot: adminProcedure.mutation(async () => {
    const task = client.createTask(TASK_NAMES.test.heapSnapShot);
    const result = task.applyAsync([]);
    const value = await result.get();
    return value;
  }),
  queueMemoryHogAlloc: adminProcedure
    .input(
      z
        .object({ mb: z.number().int().positive().max(4096).default(2048) })
        .optional()
    )
    .mutation(async ({ input }) => {
      const mb = input?.mb ?? 2048;
      const task = client.createTask(TASK_NAMES.test.memoryHogAlloc);
      const result = task.applyAsync([{ mb }]);
      const value = await result.get();
      return value;
    }),
  queueGarbageCleanup: adminProcedure.mutation(async () => {
    const task = client.createTask(TASK_NAMES.test.garbageCleanup);
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
  // Worker-only task to trigger a GC cycle and report memory stats
  garbageCleanup: queueProcedure.mutation(async () => {
    const before = process.memoryUsage();

    // Best-effort GC across runtimes (Node with --expose-gc or Bun)
    let gcExposed = false;
    try {
      const anyGlobal: any = globalThis as any;
      if (typeof anyGlobal.gc === "function") {
        anyGlobal.gc();
        gcExposed = true;
      } else if (anyGlobal.Bun && typeof anyGlobal.Bun.gc === "function") {
        // Bun exposes Bun.gc(); pass true for aggressive collection when available
        try {
          anyGlobal.Bun.gc(true);
        } catch {
          anyGlobal.Bun.gc();
        }
        gcExposed = true;
      }
    } catch (err) {
      // Swallow to avoid crashing the worker if GC call fails
      console.warn("GC invocation failed:", err);
    }

    const after = process.memoryUsage();

    const toMB = (n: number) => +(n / 1e6).toFixed(2);
    const deltas = {
      rssDeltaMB: toMB(after.rss - before.rss),
      heapUsedDeltaMB: toMB(after.heapUsed - before.heapUsed),
      heapTotalDeltaMB: toMB(after.heapTotal - before.heapTotal),
      externalDeltaMB: toMB(after.external - before.external),
      arrayBuffersDeltaMB: toMB(after.arrayBuffers - before.arrayBuffers),
    };

    return {
      timestamp: new Date().toISOString(),
      runtime: process.release?.name ?? "unknown",
      pid: process.pid,
      gcExposed,
      before: {
        rssMB: toMB(before.rss),
        heapUsedMB: toMB(before.heapUsed),
        heapTotalMB: toMB(before.heapTotal),
        externalMB: toMB(before.external),
        arrayBuffersMB: toMB(before.arrayBuffers),
        raw: before,
      },
      after: {
        rssMB: toMB(after.rss),
        heapUsedMB: toMB(after.heapUsed),
        heapTotalMB: toMB(after.heapTotal),
        externalMB: toMB(after.external),
        arrayBuffersMB: toMB(after.arrayBuffers),
        raw: after,
      },
      deltas,
    };
  }),
  // Keep a module-level reference so memory stays allocated until freed
  memoryHogAlloc: queueProcedure
    .input(z.object({ mb: z.number().int().positive().max(4096) }))
    .mutation(async ({ input }) => {
      const targetMB = input.mb;
      const before = process.memoryUsage();

      // Allocate in 64MB chunks to reduce allocation failures
      const chunkMB = 64;
      const bytesPerMB = 1024 * 1024;
      const chunks = Math.ceil(targetMB / chunkMB);

      // Prefer Buffer allocations (external memory) to avoid V8 heap limits
      // Fallback to Uint8Array if Buffer is not available
      const holder: unknown[] = [];
      let allocatedMB = 0;
      for (let i = 0; i < chunks; i++) {
        const sizeMB = Math.min(chunkMB, targetMB - allocatedMB);
        const sizeBytes = sizeMB * bytesPerMB;
        try {
          const buf =
            typeof Buffer !== "undefined"
              ? Buffer.allocUnsafe(sizeBytes)
              : new Uint8Array(sizeBytes).fill(1);
          // Touch so it's committed
          if (buf instanceof Uint8Array) {
            buf[0] = 1;
            buf[sizeBytes - 1] = 1;
          }
          holder.push(buf);
          allocatedMB += sizeMB;
        } catch (e) {
          break;
        }
      }

      // Store globally
      memoryHogStore.holder = holder;
      memoryHogStore.allocatedMB = allocatedMB;

      const after = process.memoryUsage();
      const toMB = (n: number) => +(n / 1e6).toFixed(2);
      return {
        timestamp: new Date().toISOString(),
        requestedMB: targetMB,
        allocatedMB,
        before: {
          rssMB: toMB(before.rss),
          heapUsedMB: toMB(before.heapUsed),
          externalMB: toMB(before.external),
        },
        after: {
          rssMB: toMB(after.rss),
          heapUsedMB: toMB(after.heapUsed),
          externalMB: toMB(after.external),
        },
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
