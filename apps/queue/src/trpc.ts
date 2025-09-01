import { createCaller, createQueueContext } from "@workspace/trpc/server";

const ctx = await createQueueContext({
  apiKey: "1113",
});
const api = createCaller(ctx);

export { api };
