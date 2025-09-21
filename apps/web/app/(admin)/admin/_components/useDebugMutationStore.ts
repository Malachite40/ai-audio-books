import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export interface Snapshot {
  date: string; // ISO string
  [key: string]: unknown;
}

export interface DebugMutationState {
  queueHeapSnapshots: Snapshot[];
  heapSnapshots: Snapshot[];

  // replace entire arrays
  setQueueHeapSnapshots: (data: Snapshot[]) => void;
  setHeapSnapshots: (data: Snapshot[]) => void;

  // append a single snapshot
  appendQueueHeapSnapshot: (data: Record<string, unknown>) => void;
  appendHeapSnapshot: (data: Record<string, unknown>) => void;

  // clear helpers
  clearQueueHeapSnapshots: () => void;
  clearHeapSnapshots: () => void;

  reset: () => void;
}

export const useDebugMutationStore = create<DebugMutationState>()(
  persist(
    (set) => ({
      queueHeapSnapshots: [],
      heapSnapshots: [],

      setQueueHeapSnapshots: (data) => set({ queueHeapSnapshots: data }),
      setHeapSnapshots: (data) => set({ heapSnapshots: data }),

      appendQueueHeapSnapshot: (data) =>
        set((state) => ({
          queueHeapSnapshots: [
            ...state.queueHeapSnapshots,
            { ...data, date: new Date().toISOString() },
          ],
        })),
      appendHeapSnapshot: (data) =>
        set((state) => ({
          heapSnapshots: [
            ...state.heapSnapshots,
            { ...data, date: new Date().toISOString() },
          ],
        })),

      clearQueueHeapSnapshots: () => set({ queueHeapSnapshots: [] }),
      clearHeapSnapshots: () => set({ heapSnapshots: [] }),

      reset: () => set({ queueHeapSnapshots: [], heapSnapshots: [] }),
    }),
    {
      name: "debugMutationStore",
      storage: createJSONStorage(() => localStorage),
      version: 2,
    }
  )
);
