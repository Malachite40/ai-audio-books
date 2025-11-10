// apps/cron/trpc.ts
import { createCaller, createQueueContext } from "@workspace/trpc/server";

// Build the queue context (server-to-server)
const ctx = await createQueueContext({
  apiKey: "1113",
});

// Create a typed tRPC caller
const api = createCaller(ctx);

export { api };

