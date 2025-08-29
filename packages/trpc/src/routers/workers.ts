import { PutObjectCommand } from "@aws-sdk/client-s3";
import { TRPCError } from "@trpc/server";
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
  processAudioChunkWithInworld: publicProcedure
    .input(audioChunkInput)
    .mutation(async ({ ctx, input }) => {
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

      if (!audioChunk) {
        console.error("Audio chunk not found:", input.id);
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Audio chunk not found`,
        });
      }

      await ctx.db.audioChunk.update({
        where: { id: audioChunk.id },
        data: { status: "PROCESSING" },
      });

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
          where: { id: audioChunk.id },
          data: { status: "ERROR" },
        });
        throw new TRPCError({
          code: "BAD_GATEWAY",
          message: `Could not reach Inworld TTS API: ${
            err instanceof Error ? err.message : String(err)
          }`,
        });
      }

      if (!resp.ok) {
        await ctx.db.audioChunk.update({
          where: { id: audioChunk.id },
          data: { status: "ERROR" },
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
          where: { id: audioChunk.id },
          data: { status: "ERROR" },
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
          where: { id: audioChunk.id },
          data: { status: "ERROR" },
        });
        throw new TRPCError({
          code: "BAD_GATEWAY",
          message: `Received buffer too small to be audio (${wavBuffer.length} bytes)`,
        });
      }

      // Upload to S3
      const audioId = `${audioChunk.id}.mp3`;
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
      } catch (err) {
        console.error("S3 upload error:", err);
        await ctx.db.audioChunk.update({
          where: { id: audioChunk.id },
          data: { status: "ERROR" },
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `ERROR to upload audio to storage: ${
            err instanceof Error ? err.message : String(err)
          }`,
        });
      }

      const mime = detectMime(wavBuffer);
      const durationMs = await getAudioDurationMs(wavBuffer, mime);

      await ctx.db.audioChunk.update({
        where: {
          id: audioChunk.id,
        },
        data: {
          status: "PROCESSED",
          url: env.NEXT_PUBLIC_AUDIO_BUCKET_URL + "/" + audioId,
          //calculate duration in ms of wavBuffer
          durationMs: durationMs,
        },
      });
      console.log(
        "Audio chunk processing with Inworld completed successfully."
      );

      const blockingChunks = await ctx.db.audioChunk.count({
        where: {
          audioFileId: audioChunk.audioFileId,
          status: {
            in: ["PENDING", "PROCESSING"],
          },
        },
      });

      // if last chunk that is processing, mark audio file as processed
      if (blockingChunks > 0) {
        // fetch all and calculate duration
        const allChunks = await ctx.db.audioChunk.findMany({
          where: { audioFileId: audioChunk.audioFileId },
        });
        const totalDuration = allChunks.reduce((sum, chunk) => {
          return (
            sum + chunk.durationMs + chunk.paddingStartMs + chunk.paddingEndMs
          );
        }, 0);
        await ctx.db.audioFile.update({
          where: { id: audioChunk.audioFileId },
          data: { status: "PROCESSED", durationMs: totalDuration },
        });
      }

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
      const BATCH_SIZE = 15;
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

function wavDurationMs(wav: Buffer) {
  // Very basic: assumes PCM WAV with a standard fmt/data layout.
  const numChannels = wav.readUInt16LE(22);
  const sampleRate = wav.readUInt32LE(24);
  const bitsPerSample = wav.readUInt16LE(34);
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  // Find the "data" chunk
  let offset = 12;
  while (offset + 8 <= wav.length) {
    const id = wav.toString("ascii", offset, offset + 4);
    const size = wav.readUInt32LE(offset + 4);
    if (id === "data") {
      const seconds = size / byteRate;
      return Math.round(seconds * 1000);
    }
    offset += 8 + size + (size % 2); // chunks are word-aligned
  }
  throw new Error("No data chunk in WAV");
}

function mp3DurationMs(buf: Buffer): number {
  // Skip ID3v2 tag if present
  let i = 0;
  if (buf.slice(0, 3).toString("ascii") === "ID3") {
    const size =
      ((buf[6]! & 0x7f) << 21) |
      ((buf[7]! & 0x7f) << 14) |
      ((buf[8]! & 0x7f) << 7) |
      (buf[9]! & 0x7f);
    i = 10 + size;
  }
  // Find MPEG frame sync
  while (
    i + 4 < buf.length &&
    !(buf[i] === 0xff && (buf[i + 1]! & 0xe0) === 0xe0)
  )
    i++;
  if (i + 4 >= buf.length) throw new Error("No MPEG frame found");

  const verBits = (buf[i + 1]! >> 3) & 0x03;
  const layerBits = (buf[i + 1]! >> 1) & 0x03;
  const bpsIdx = (buf[i + 2]! >> 4) & 0x0f;

  // MPEG version
  const v = verBits === 3 ? "V1" : verBits === 2 ? "V2" : "V2.5";
  // Layer
  const l = layerBits === 1 ? "L3" : layerBits === 2 ? "L2" : "L1";

  const brTables: Record<string, number[]> = {
    V1L3: [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0],
    V2L3: [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0],
    V1L2: [
      0, 32, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 384, 0,
    ],
    V1L1: [
      0, 32, 64, 96, 128, 160, 192, 224, 256, 288, 320, 352, 384, 416, 448, 0,
    ],
    V2L2: [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0],
    V2L1: [
      0, 32, 48, 56, 64, 80, 96, 112, 128, 144, 160, 176, 192, 224, 256, 0,
    ],
  };
  const key = `${v}${l}`;
  const kbps = (brTables[key]! ?? brTables["V1L3"])[bpsIdx];
  if (!kbps) throw new Error("Unsupported/variable bitrate");

  const audioBytes = buf.length - i; // ignore leading tags
  const seconds = (audioBytes * 8) / (kbps * 1000);
  return Math.round(seconds * 1000);
}

async function getAudioDurationMs(buf: Buffer, mime?: string) {
  if (mime === "audio/mpeg") return mp3DurationMs(buf);
  return wavDurationMs(buf); // your existing WAV parser
}

function detectMime(buf: Buffer): "audio/mpeg" | "audio/wav" {
  if (
    buf.slice(0, 4).toString("ascii") === "RIFF" &&
    buf.slice(8, 12).toString("ascii") === "WAVE"
  )
    return "audio/wav";
  if (
    buf.slice(0, 3).toString("ascii") === "ID3" ||
    (buf[0] === 0xff && (buf[1]! & 0xe0) === 0xe0)
  )
    return "audio/mpeg";
  // default to mp3 for TTS
  return "audio/mpeg";
}
