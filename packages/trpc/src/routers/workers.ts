import { PutObjectCommand } from "@aws-sdk/client-s3";
import { TRPCError } from "@trpc/server";
import { AudioChunkStatus } from "@workspace/database";
import z from "zod";
import { env } from "../env";
import { client } from "../queue/client";
import { s3Client } from "../s3";
import { TASK_NAMES } from "../server";
import { createTRPCRouter, publicProcedure } from "../trpc";

export const audioChunkInput = z.object({
  id: z.string().uuid(),
});

export const processAudioFileInput = z.object({
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
      //@ts-ignore
      console.log("speaker.speakerEmbedding:", speaker.speakerEmbedding.length);
      //@ts-ignore
      console.log("speaker.gptCondLatent:", speaker.gptCondLatent.length);

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
            speaker_embedding: speaker!.speakerEmbedding,
            gpt_cond_latent: speaker!.gptCondLatent,
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
  processAudioChunkWithInworld: publicProcedure
    .input(audioChunkInput)
    .mutation(async ({ ctx, input }) => {
      console.log(
        "Starting processing of audio chunk with Inworld API",
        input.id
      );
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

      const chunkId = audioChunk.id;

      console.log(`Updating audio chunk ${chunkId} status to PROCESSING`);
      await ctx.db.audioChunk.update({
        where: { id: audioChunk.id },
        data: { status: AudioChunkStatus.PROCESSING },
      });
      console.log("Audio chunk status updated to PROCESSING.");

      let resp: Response;
      try {
        console.log("Sending request to Inworld TTS API...");
        resp = await fetch("https://api.inworld.ai/tts/v1/voice", {
          method: "POST",
          headers: {
            Authorization: `Basic ${env.INWORLD_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text: audioChunk.text,
            voiceId: audioChunk.audioFile.speaker.name,
            modelId: "inworld-tts-1",
          }),
        });
        console.log(
          "Received response from Inworld TTS API with status:",
          resp.status
        );
      } catch (err: unknown) {
        console.error("Error calling Inworld TTS API:", err);
        await ctx.db.audioChunk.update({
          where: { id: chunkId },
          data: { status: AudioChunkStatus.ERROR },
        });
        throw new TRPCError({
          code: "BAD_GATEWAY",
          message: `Could not reach Inworld TTS API: ${
            err instanceof Error ? err.message : String(err)
          }`,
        });
      }

      if (!resp.ok) {
        console.error("Inworld TTS API returned error status:", resp.status);
        await ctx.db.audioChunk.update({
          where: { id: chunkId },
          data: { status: AudioChunkStatus.ERROR },
        });
        const txt = await resp.text();
        console.error("Inworld TTS API error response:", txt);
        throw new TRPCError({
          code: "BAD_GATEWAY",
          message: `Inworld TTS service error ${resp.status}: ${txt}`,
        });
      }

      let wavBuffer: Buffer;
      try {
        const result = await resp.json();
        if (!result.audioContent || typeof result.audioContent !== "string") {
          throw new Error(
            "Missing or invalid audioContent in Inworld response"
          );
        }
        // Inworld returns MP3 base64, but we want WAV for consistency.
        // If you want to keep as MP3, change ContentType below to "audio/mpeg" and .wav to .mp3
        // Here, we'll save as MP3.
        wavBuffer = Buffer.from(result.audioContent, "base64");
        console.log(
          "Received audio buffer from Inworld, length:",
          wavBuffer.length
        );
      } catch (err) {
        console.error("Failed to parse Inworld TTS API response:", err);
        await ctx.db.audioChunk.update({
          where: { id: chunkId },
          data: { status: AudioChunkStatus.ERROR },
        });
        throw new TRPCError({
          code: "BAD_GATEWAY",
          message: `Failed to parse Inworld TTS API response: ${
            err instanceof Error ? err.message : String(err)
          }`,
        });
      }

      if (wavBuffer.length < 100) {
        // MP3 header is much smaller than WAV, but still check for tiny files
        console.error(
          "Received buffer too small to be audio:",
          wavBuffer.length
        );
        await ctx.db.audioChunk.update({
          where: { id: chunkId },
          data: { status: AudioChunkStatus.ERROR },
        });
        throw new TRPCError({
          code: "BAD_GATEWAY",
          message: `Received buffer too small to be audio (${wavBuffer.length} bytes)`,
        });
      }

      // Upload to S3
      const audioId = `${audioChunk.id}.mp3`;
      console.log("Uploading Inworld audio to S3 with key:", audioId);
      try {
        const put = new PutObjectCommand({
          Bucket: env.NEXT_PUBLIC_CLOUD_FLARE_AUDIO_BUCKET_NAME,
          Key: audioId,
          Body: wavBuffer,
          ContentType: "audio/mpeg",
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
      console.log(
        "Audio chunk processing with Inworld completed successfully."
      );
      return {};
    }),
  processAudioFile: publicProcedure
    .input(processAudioFileInput)
    .mutation(async ({ ctx, input }) => {
      const chunks = await ctx.db.audioChunk.findMany({
        where: { audioFileId: input.id },
        orderBy: { sequence: "asc" },
      });

      // Kick off TTS/processing for each chunk
      const BATCH_SIZE = 5;
      for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
        const batch = chunks.slice(i, i + BATCH_SIZE);
        await Promise.all(
          batch.map((chunk) => {
            const task = client.createTask(
              TASK_NAMES.processAudioChunkWithInworld
            );
            return task.applyAsync([
              { id: chunk.id } satisfies z.infer<typeof audioChunkInput>,
            ]);
          })
        );
        // sleep
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
      return {};
    }),
});
