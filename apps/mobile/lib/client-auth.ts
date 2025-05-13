import { expoClient } from "@better-auth/expo/client";
import { createAuthClient } from "better-auth/react";
import * as SecureStore from "expo-secure-store";

export const authClient = createAuthClient({
  baseURL: process.env.EXPO_PUBLIC_BETTER_AUTH_URL,
  plugins: [
    expoClient({
      scheme: "ai-audio-books",
      storagePrefix: "ai-audio-books",
      storage: SecureStore,
    }),
  ],
});
