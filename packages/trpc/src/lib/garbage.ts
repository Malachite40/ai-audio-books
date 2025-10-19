export function forceGarbageCollection() {
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
}
