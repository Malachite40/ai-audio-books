import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { env } from "../env";

const globalForOpenRouter = globalThis as unknown as {
  openrouter?: ReturnType<typeof createOpenRouter>;
};

export const openrouter =
  globalForOpenRouter.openrouter ??
  createOpenRouter({
    apiKey: env.OPENROUTER_API_KEY,
  });

if (process.env.NODE_ENV !== "production") {
  globalForOpenRouter.openrouter = openrouter;
}
