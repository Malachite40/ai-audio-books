import jwt from "jsonwebtoken";
import { env } from "../env";

const privateKey = env.APPLE_PRIVATE_KEY.replace(/\\n/g, "\n");

// Timestamps in seconds
const now = Math.floor(Date.now() / 1000);
const exp = now + 15777000; // max 6 months

export const APPLE_SECRET_ID = jwt.sign(
  {
    iss: env.APPLE_TEAM_ID,
    iat: now,
    exp: exp,
    aud: "https://appleid.apple.com",
    sub: env.APPLE_CLIENT_ID,
  },
  privateKey,
  {
    algorithm: "ES256",
    keyid: env.APPLE_KEY_ID,
  }
);
