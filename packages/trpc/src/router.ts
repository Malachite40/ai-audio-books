import { audioRouter } from "./routers/audio";
import { creditsRouter } from "./routers/credits";
import { debugRouter } from "./routers/debug";
import { emailsRouter } from "./routers/emails";
import { keyValueRouter } from "./routers/keyValueRouter";
import { redditRouter } from "./routers/reddit/reddit";
import { referralsRouter } from "./routers/referrals";
import { speakersRouter } from "./routers/speakers";
import { statsRouter } from "./routers/stats";
import { stripeRouter } from "./routers/stripe";
import { subscriptionsRouter } from "./routers/subscriptions";
import { supportRouter } from "./routers/support";
import { usersRouter } from "./routers/users";
import { workersRouter } from "./routers/workers";
import { createCallerFactory, createTRPCRouter } from "./trpc";

export const appRouter = createTRPCRouter({
  users: usersRouter,
  speakers: speakersRouter,
  audio: audioRouter,
  workers: workersRouter,
  credits: creditsRouter,
  stripe: stripeRouter,
  subscriptions: subscriptionsRouter,
  support: supportRouter,
  kv: keyValueRouter,
  emails: emailsRouter,
  debug: debugRouter,
  referrals: referralsRouter,
  stats: statsRouter,
  reddit: redditRouter,
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
