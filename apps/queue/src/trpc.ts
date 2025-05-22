import { createCaller, createContext } from "@workspace/trpc/server";

const ctx = await createContext();
const api = createCaller(ctx);

export { api };
