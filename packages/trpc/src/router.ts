import { audioRouter } from "./routers/audio";
import { speakersRouter } from "./routers/speakers";
import { usersRouter } from "./routers/users";
import { workersRouter } from "./routers/workers";
import { xttsRouter } from "./routers/xtts";
import { createCallerFactory, createTRPCRouter } from "./trpc";

export const appRouter = createTRPCRouter({
  users: usersRouter,
  xtts: xttsRouter,
  speakers: speakersRouter,
  audio: audioRouter,
  workers: workersRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;

/**
 * Create a server-side caller for the tRPC API.
 * @example
 * const trpc = createCaller(createContext);
 * const res = await trpc.post.all();
 *       ^? Post[]
 */
export const createCaller = createCallerFactory(appRouter);
