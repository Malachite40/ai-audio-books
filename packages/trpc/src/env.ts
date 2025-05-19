import { createEnv } from "@t3-oss/env-nextjs";
import { config } from "dotenv";
import { z } from "zod";
config();

export const env = createEnv({
  /**
   * Specify your server-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars.
   */
  server: {
    DATABASE_URL: z.string().url(),
    CLOUD_FLARE_ACCESS_KEY_ID: z.string(),
    CLOUD_FLARE_SECRET_ACCESS_KEY: z.string(),
    CLOUD_FLARE_R2_ENDPOINT: z.string().url(),
    CLOUD_FLARE_AUDIO_BUCKET_NAME: z.string(),
  },

  /**
   * Specify your client-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars. To expose them to the client, prefix them with
   * `NEXT_PUBLIC_`.
   */
  client: {
    NEXT_PUBLIC_BASE_URL: z.string().url(),
  },

  /**
   * You can't destruct `process.env` as a regular object in the Next.js edge runtimes (e.g.
   * middlewares) or client-side so we need to destruct manually.
   */
  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL,
    CLOUD_FLARE_ACCESS_KEY_ID: process.env.CLOUD_FLARE_ACCESS_KEY_ID,
    CLOUD_FLARE_SECRET_ACCESS_KEY: process.env.CLOUD_FLARE_SECRET_ACCESS_KEY,
    CLOUD_FLARE_R2_ENDPOINT: process.env.CLOUD_FLARE_R2_ENDPOINT,
    CLOUD_FLARE_AUDIO_BUCKET_NAME: process.env.CLOUD_FLARE_AUDIO_BUCKET_NAME,
  },
  /**
   * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially
   * useful for Docker builds.
   */
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  /**
   * Makes it so that empty strings are treated as undefined. `SOME_VAR: z.string()` and
   * `SOME_VAR=''` will throw an error.
   */
  emptyStringAsUndefined: true,
});
