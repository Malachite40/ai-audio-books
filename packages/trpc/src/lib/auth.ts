import { expo } from "@better-auth/expo";
import { prisma } from "@workspace/database";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { admin } from "better-auth/plugins";
import { env } from "../env";
import { APPLE_SECRET_ID } from "./apple-web-token";

const APP_SCHEME = "ai-audio-books";

export const auth = betterAuth({
  // baseURL: "https://many-macaque-evolving.ngrok-free.app", // this is used when testing apple login locally
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  trustedOrigins: [
    env.BETTER_AUTH_URL,
    `${APP_SCHEME}://`,
    "exp://",
    "https://appleid.apple.com",
  ],
  socialProviders: {
    google: {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
    },
    apple: {
      clientId: env.APPLE_CLIENT_ID as string,
      clientSecret: APPLE_SECRET_ID,
      appBundleIdentifier: env.APPLE_BUNDLE_ID,
    },
  },
  user: {
    additionalFields: {
      stripeCustomerId: {
        type: "string",
        required: false,
      },
    },
  },
  plugins: [nextCookies(), admin({}), expo()],
});
