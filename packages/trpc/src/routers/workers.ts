import { PutObjectCommand } from "@aws-sdk/client-s3";
import { TRPCError } from "@trpc/server";
import { AudioChunkStatus } from "@workspace/database";
import z from "zod";
import { env } from "../env";
import { s3Client } from "../s3";
import { createTRPCRouter, publicProcedure } from "../trpc";

export const audioChunkInput = z.object({
  id: z.string().uuid(),
});

export const workersRouter = createTRPCRouter({
  processAudioChunk: publicProcedure
    .input(audioChunkInput)
    .mutation(async ({ ctx, input }) => {
      console.log("Starting processing of audio chunk", input.id);
      const audioChunk = await ctx.db.audioChunk.findUnique({
        where: { id: input.id },
        include: {
          audioFile: {
            include: {
              _count: {
                select: {
                  AudioChunks: true,
                },
              },
              speaker: true,
            },
          },
        },
      });
      console.log("Retrieved audio chunk:", audioChunk);

      if (!audioChunk) {
        console.error("Audio chunk not found:", input.id);
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Audio chunk not found`,
        });
      }
      const speaker = audioChunk.audioFile.speaker;
      console.log("Speaker info:", speaker);

      const chunkId = audioChunk.id;

      console.log(`Updating audio chunk ${chunkId} status to PROCESSING`);
      await ctx.db.audioChunk.update({
        where: { id: audioChunk.id },
        data: { status: AudioChunkStatus.PROCESSING },
      });
      console.log("Audio chunk status updated to PROCESSING.");

      let resp: Response;
      try {
        console.log("Sending request to TTS server...");
        resp = await fetch(`${env.XTTS_API_URL}/tts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: audioChunk.text,
            speaker_embedding: speaker.speakerEmbedding,
            gpt_cond_latent: speaker.gptCondLatent,
            language: audioChunk.audioFile.lang,
          }),
        });
        console.log(
          "Received response from TTS server with status:",
          resp.status
        );
      } catch (err: unknown) {
        console.error("Error calling TTS server:", err);
        await ctx.db.audioChunk.update({
          where: { id: chunkId },
          data: { status: AudioChunkStatus.ERROR },
        });
        throw new TRPCError({
          code: "BAD_GATEWAY",
          message: `Could not reach TTS server: ${
            err instanceof Error ? err.message : String(err)
          }`,
        });
      }

      if (!resp.ok) {
        console.error("TTS server returned error status:", resp.status);
        await ctx.db.audioChunk.update({
          where: { id: chunkId },
          data: { status: AudioChunkStatus.ERROR },
        });
        const txt = await resp.text();
        console.error("TTS server error response:", txt);
        throw new TRPCError({
          code: "BAD_GATEWAY",
          message: `TTS service error ${resp.status}: ${txt}`,
        });
      }

      const contentType = resp.headers.get("Content-Type") || "";
      console.log("Response Content-Type:", contentType);
      let wavBuffer: Buffer;

      if (contentType.includes("application/json")) {
        console.log("Parsing JSON response for audio...");
        const maybeB64 = await resp.json();
        if (typeof maybeB64 !== "string") {
          console.error("Unexpected JSON payload:", maybeB64);
          throw new TRPCError({
            code: "BAD_GATEWAY",
            message: `Unexpected JSON payload: ${JSON.stringify(maybeB64)}`,
          });
        }
        wavBuffer = Buffer.from(maybeB64, "base64");
      } else {
        console.log("Processing raw byte response...");
        const array = await resp.arrayBuffer();
        wavBuffer = Buffer.from(array);
      }

      console.log("WAV buffer length:", wavBuffer.length);
      if (wavBuffer.length <= 44) {
        console.error("Received buffer too small to be WAV:", wavBuffer.length);
        await ctx.db.audioChunk.update({
          where: { id: chunkId },
          data: { status: AudioChunkStatus.ERROR },
        });
        throw new TRPCError({
          code: "BAD_GATEWAY",
          message: `Received buffer too small to be WAV (${wavBuffer.length} bytes)`,
        });
      }

      //upload to S3
      const audioId = `${audioChunk.id}.wav`;
      console.log("Uploading audio to S3 with key:", audioId);
      try {
        const put = new PutObjectCommand({
          Bucket: env.NEXT_PUBLIC_CLOUD_FLARE_AUDIO_BUCKET_NAME,
          Key: audioId,
          Body: wavBuffer,
          ContentType: "audio/wav",
        });
        console.log(
          "S3 upload URL:",
          env.NEXT_PUBLIC_AUDIO_BUCKET_URL + "/" + audioId
        );
        await s3Client.send(put);
        console.log("S3 upload completed successfully.");
      } catch (err) {
        console.error("S3 upload error:", err);
        await ctx.db.audioChunk.update({
          where: { id: chunkId },
          data: { status: AudioChunkStatus.ERROR },
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `ERROR to upload audio to storage: ${
            err instanceof Error ? err.message : String(err)
          }`,
        });
      }

      console.log("Updating audio chunk status to PROCESSED.");
      await ctx.db.audioChunk.update({
        where: {
          id: chunkId,
        },
        data: {
          status: AudioChunkStatus.PROCESSED,
          url: env.NEXT_PUBLIC_AUDIO_BUCKET_URL + "/" + audioId,
        },
      });
      console.log("Audio chunk processing completed successfully.");
      return {};
    }),
});
