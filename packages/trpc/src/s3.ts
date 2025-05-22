import { S3Client } from "@aws-sdk/client-s3";
import { env } from "./env";
export const s3Client = new S3Client({
  region: "auto",
  endpoint: env.NEXT_PUBLIC_CLOUD_FLARE_R2_ENDPOINT,
  credentials: {
    accessKeyId: env.CLOUD_FLARE_ACCESS_KEY_ID,
    secretAccessKey: env.CLOUD_FLARE_SECRET_ACCESS_KEY,
  },
});
