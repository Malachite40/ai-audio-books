import { createPresignedPost } from "@aws-sdk/s3-presigned-post";
import { v4 as uuidv4 } from "uuid";
import { env } from "../env";
import { s3Client } from "../s3";
import { authenticatedProcedure, createTRPCRouter } from "../trpc";

export const imagesRouter = createTRPCRouter({
  getPresignedPost: authenticatedProcedure.mutation(async ({ ctx }) => {
    const imageId = uuidv4();
    const presignedPost = await createPresignedPost(s3Client, {
      Bucket: env.CLOUD_FLARE_AUDIO_BUCKET_NAME,
      Key: imageId,
    });

    return { presignedPost, imageId };
  }),
});
