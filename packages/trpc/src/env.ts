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
    BETTER_AUTH_URL: z.string().url(),
    GOOGLE_CLIENT_SECRET: z.string(),
    GOOGLE_CLIENT_ID: z.string(),

    DATABASE_URL: z.string().url(),
    CLOUD_FLARE_ACCESS_KEY_ID: z.string(),
    CLOUD_FLARE_SECRET_ACCESS_KEY: z.string(),
    XTTS_API_URL: z.string().url(),
    INWORLD_API_KEY: z.string(),
    APPLE_CLIENT_ID: z.string(),
    APPLE_TEAM_ID: z.string(),
    APPLE_KEY_ID: z.string(),
    APPLE_PRIVATE_KEY: z.string(),
    APPLE_BUNDLE_ID: z.string(),
    STRIPE_BASIC_PLAN: z.string(),
    STRIPE_PRO_PLAN: z.string(),
    TAX_RATE_ID: z.string(),
    ONE_M_CREDIT_PRICE: z.string(),
    OPENAI_API_KEY: z.string(),
    RESEND_API_KEY: z.string(),
  },

  /**
   * Specify your client-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars. To expose them to the client, prefix them with
   * `NEXT_PUBLIC_`.
   */
  client: {
    NEXT_PUBLIC_BASE_URL: z.string().url(),
    NEXT_PUBLIC_CLOUD_FLARE_R2_ENDPOINT: z.string().url(),
    NEXT_PUBLIC_CLOUD_FLARE_AUDIO_BUCKET_NAME: z.string(),
    NEXT_PUBLIC_AUDIO_BUCKET_URL: z.string().url(),
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
    NEXT_PUBLIC_CLOUD_FLARE_R2_ENDPOINT:
      process.env.NEXT_PUBLIC_CLOUD_FLARE_R2_ENDPOINT,
    NEXT_PUBLIC_CLOUD_FLARE_AUDIO_BUCKET_NAME:
      process.env.NEXT_PUBLIC_CLOUD_FLARE_AUDIO_BUCKET_NAME,
    NEXT_PUBLIC_AUDIO_BUCKET_URL: process.env.NEXT_PUBLIC_AUDIO_BUCKET_URL,
    XTTS_API_URL: process.env.XTTS_API_URL,
    INWORLD_API_KEY: process.env.INWORLD_API_KEY,
    APPLE_CLIENT_ID: process.env.APPLE_CLIENT_ID,
    APPLE_TEAM_ID: process.env.APPLE_TEAM_ID,
    APPLE_KEY_ID: process.env.APPLE_KEY_ID,
    APPLE_PRIVATE_KEY: process.env.APPLE_PRIVATE_KEY,
    APPLE_BUNDLE_ID: process.env.APPLE_BUNDLE_ID,
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    STRIPE_BASIC_PLAN: process.env.STRIPE_BASIC_PLAN,
    STRIPE_PRO_PLAN: process.env.STRIPE_PRO_PLAN,
    TAX_RATE_ID: process.env.TAX_RATE_ID,
    ONE_M_CREDIT_PRICE: process.env.ONE_M_CREDIT_PRICE,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
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
