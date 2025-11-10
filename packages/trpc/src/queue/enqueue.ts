import { client } from "./client";
import { TASK_NAMES } from "./index";

// Recursively collect all leaf values
type DeepValueOf<T> = T extends object
  ? { [K in keyof T]: DeepValueOf<T[K]> }[keyof T]
  : T;

// The union of all task name strings:
export type TaskName = Extract<DeepValueOf<typeof TASK_NAMES>, string>;
declare global {
  // Persist the task cache on the global object so it isn't recreated across reloads
  var __trpc_taskCache__:
    | Map<string, ReturnType<typeof client.createTask>>
    | undefined;
}

const taskCache: Map<
  string,
  ReturnType<typeof client.createTask>
> = globalThis.__trpc_taskCache__ ??
(globalThis.__trpc_taskCache__ = new Map());

const getTask = (name: string) => {
  const cached = taskCache.get(name);
  if (cached) return cached;
  const created = client.createTask(name);
  taskCache.set(name, created);
  return created;
};

export async function enqueueTask(task: TaskName, payload: unknown) {
  await client.isReady();
  return getTask(task).applyAsync([payload]);
}
