import { audioRouter } from "./audio";
import { creditsRouter } from "./credits";
import { imagesRouter } from "./images";
import { inworldRouter } from "./inworld";
import { speakersRouter } from "./speakers";
import { stripeRouter } from "./stripe";
import { subscriptionsRouter } from "./subscriptions";
import { supportRouter } from "./support";
import { usersRouter } from "./users";
import { workersRouter } from "./workers";

export const appRouter = {
  audio: audioRouter,
  credits: creditsRouter,
  images: imagesRouter,
  inworld: inworldRouter,
  speakers: speakersRouter,
  stripe: stripeRouter,
  subscriptions: subscriptionsRouter,
  users: usersRouter,
  workers: workersRouter,
  support: supportRouter,
};
