import { client } from "./client";
import type { TaskName, TaskPayload } from "./index";

declare global {
  // Persist the task cache on the global object so it isn't recreated across reloads
  var __trpc_taskCache__:
    | Map<TaskName, ReturnType<typeof client.createTask>>
    | undefined;
}

const taskCache: Map<
  TaskName,
  ReturnType<typeof client.createTask>
> = globalThis.__trpc_taskCache__ ??
(globalThis.__trpc_taskCache__ = new Map());

const getTask = (name: TaskName) => {
  const cached = taskCache.get(name);
  if (cached) return cached;
  const created = client.createTask(name);
  taskCache.set(name, created);
  return created;
};

export async function enqueueTask<N extends TaskName>(
  name: N,
  ...[payload]: TaskPayload<N> extends void
    ? [payload?: TaskPayload<N>]
    : [payload: TaskPayload<N>]
) {
  await client.isReady();
  return getTask(name).applyAsync(
    payload === undefined ? [] : [payload]
  );
}
