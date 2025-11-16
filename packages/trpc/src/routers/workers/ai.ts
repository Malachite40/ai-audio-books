import { openai } from "@ai-sdk/openai";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { experimental_generateImage as generateImage } from "ai";
import { v4 } from "uuid";
import z from "zod";
import { env } from "../../env";
import { generateStory } from "../../lib/story-generation";
import { TASK_NAMES } from "../../queue";
import { enqueueTask } from "../../queue/enqueue";
import { s3Client } from "../../s3";
import { createTRPCRouter, queueProcedure } from "../../trpc";

export const generateStoryInput = z.object({
  audioFileId: z.string().uuid(),
  prompt: z.string(),
  durationMinutes: z.number(),
});

export const generateImageInput = z.object({
  audioFileId: z.string().uuid(),
  prompt: z.string().max(100),
});

export type GenerateStoryInput = z.infer<typeof generateStoryInput>;
export type GenerateImageInput = z.infer<typeof generateImageInput>;

export const aiWorkerRouter = createTRPCRouter({
  generateImage: queueProcedure
    .input(generateImageInput)
    .mutation(async ({ input, ctx }) => {
      // TODO: maybe set the image to a loading image while it updates?
      await ctx.db.audioFile.update({
        where: { id: input.audioFileId },
        data: {
          imageUrl:
            env.NEXT_PUBLIC_AUDIO_BUCKET_URL +
            "/image-generating-placeholder.png",
        },
      });

      const { image } = await generateImage({
        model: openai.image("dall-e-2"),
        prompt: input.prompt,
        n: 1,
        size: "1024x1024",
        aspectRatio: "1:1",
      });

      const { key } = await uploadImageBytesToR2(image.uint8Array, {
        contentType: image.mediaType,
      });

      await ctx.db.audioFile.update({
        where: { id: input.audioFileId },
        data: { imageUrl: env.NEXT_PUBLIC_AUDIO_BUCKET_URL + "/" + key },
      });

      return {};
    }),
  generateStory: queueProcedure
    .input(generateStoryInput)
    .mutation(async ({ ctx, input }) => {
      await ctx.db.audioFile.update({
        where: { id: input.audioFileId },
        data: { status: "GENERATING_STORY" },
      });

      const { title, story } = await generateStory({
        duration: input.durationMinutes,
        prompt: input.prompt,
      });

      await ctx.db.audioFile.update({
        where: { id: input.audioFileId },
        data: { name: title, text: story },
      });

      await enqueueTask(TASK_NAMES.ai.generateImage, {
        audioFileId: input.audioFileId,
        prompt: `Generate an image for a story, the: ${title}.`,
      });

      await enqueueTask(TASK_NAMES.audio.createAudioFileChunks, {
        audioFileId: input.audioFileId,
        chunkSize: 500,
        includeTitle: true,
      });

      return {};
    }),
});

export async function uploadImageBytesToR2(
  bytes: Uint8Array | Buffer,
  opts?: { contentType?: string }
) {
  const id = v4();
  const contentType = opts?.contentType ?? "image/png";
  const key = `${"images"}/${id}.${mimeExtFromType(contentType)}`;

  await s3Client.send(
    new PutObjectCommand({
      Bucket: env.NEXT_PUBLIC_CLOUD_FLARE_AUDIO_BUCKET_NAME,
      Key: key,
      Body: Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes),
      ContentType: contentType,
    })
  );

  return { key };
}

function mimeExtFromType(t: string) {
  if (t.includes("png")) return "png";
  if (t.includes("jpeg") || t.includes("jpg")) return "jpg";
  if (t.includes("webp")) return "webp";
  return "bin";
}
