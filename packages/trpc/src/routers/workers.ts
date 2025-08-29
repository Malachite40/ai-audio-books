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
                select: { AudioChunks: true },
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

      // Inworld returns MP3 base64; we store as MP3.
      let audioBuffer: Buffer;
      try {
        const result = await resp.json();
        if (!result.audioContent || typeof result.audioContent !== "string") {
          throw new Error(
            "Missing or invalid audioContent in Inworld response"
          );
        }
        audioBuffer = Buffer.from(result.audioContent, "base64");
        console.log(
          "Received audio buffer from Inworld, length:",
          audioBuffer.length
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

      if (audioBuffer.length < 100) {
        console.error(
          "Received buffer too small to be audio:",
          audioBuffer.length
        );
        await ctx.db.audioChunk.update({
          where: { id: audioChunk.id },
          data: { status: "ERROR" },
        });
        throw new TRPCError({
          code: "BAD_GATEWAY",
          message: `Received buffer too small to be audio (${audioBuffer.length} bytes)`,
        });
      }

      // Upload to S3
      const audioId = `${audioChunk.id}.mp3`;
      try {
        const put = new PutObjectCommand({
          Bucket: env.NEXT_PUBLIC_CLOUD_FLARE_AUDIO_BUCKET_NAME,
          Key: audioId,
          Body: audioBuffer,
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

      // Detect mime + compute precise duration (supports WAV + CBR/VBR MP3)
      const mime = detectMime(audioBuffer);
      const durationMs = await getAudioDurationMs(audioBuffer, mime);

      // Save chunk with RAW audio duration (no padding)
      await ctx.db.audioChunk.update({
        where: { id: audioChunk.id },
        data: {
          status: "PROCESSED",
          url: env.NEXT_PUBLIC_AUDIO_BUCKET_URL + "/" + audioId,
          durationMs: Math.max(0, Math.round(durationMs)),
        },
      });

      console.log(
        "Audio chunk processed successfully. Recomputing file total…"
      );

      // Keep the parent file's duration in sync with AudioClip's timeline math:
      // total = Σ (chunk.durationMs + paddingStartMs + paddingEndMs)
      const allForFile = await ctx.db.audioChunk.findMany({
        where: { audioFileId: audioChunk.audioFileId },
        select: {
          status: true,
          durationMs: true,
          paddingStartMs: true,
          paddingEndMs: true,
        },
        orderBy: { sequence: "asc" },
      });

      const totalDuration = allForFile.reduce((sum, c) => {
        const d = Math.max(0, Math.round(c.durationMs ?? 0));
        const p0 = Math.max(0, Math.round(c.paddingStartMs ?? 0));
        const p1 = Math.max(0, Math.round(c.paddingEndMs ?? 0));
        return sum + d + p0 + p1;
      }, 0);

      await ctx.db.audioFile.update({
        where: { id: audioChunk.audioFileId },
        data: { durationMs: totalDuration },
      });

      // Finalize file status only when ALL chunks are PROCESSED
      const statusList = allForFile.map((c) => c.status);
      const allProcessed =
        statusList.length > 0 && statusList.every((s) => s === "PROCESSED");

      if (allProcessed) {
        await ctx.db.audioFile.update({
          where: { id: audioChunk.audioFileId },
          data: { status: "PROCESSED" },
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

      // Kick off TTS/processing for each chunk in batches
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
        // simple throttle
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
      return {};
    }),
});

/* ─────────────────────────────────────────────────────────────────────────────
   Helpers: Duration detection (WAV + robust MP3, incl. VBR via Xing/Info/VBRI)
   ──────────────────────────────────────────────────────────────────────────── */

function wavDurationMs(wav: Buffer) {
  // Very basic: assumes PCM WAV with a standard fmt/data layout.
  if (
    wav.slice(0, 4).toString("ascii") !== "RIFF" ||
    wav.slice(8, 12).toString("ascii") !== "WAVE"
  ) {
    throw new Error("Not a WAV file");
  }
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

function readUInt32BE(buf: Buffer, off: number) {
  return (
    ((buf[off]! << 24) |
      (buf[off + 1]! << 16) |
      (buf[off + 2]! << 8) |
      buf[off + 3]!) >>>
    0
  );
}

function skipID3v2(buf: Buffer) {
  if (buf.length >= 10 && buf.slice(0, 3).toString("ascii") === "ID3") {
    const size =
      ((buf[6]! & 0x7f) << 21) |
      ((buf[7]! & 0x7f) << 14) |
      ((buf[8]! & 0x7f) << 7) |
      (buf[9]! & 0x7f);
    return 10 + size;
  }
  return 0;
}

type MpegHeader = {
  version: 1 | 2 | 25; // 1 = MPEG1, 2 = MPEG2, 25 = MPEG2.5
  layer: 1 | 2 | 3;
  bitrateKbps: number;
  sampleRate: number;
  padding: 0 | 1;
  channels: 1 | 2;
  samplesPerFrame: number;
  frameLengthBytes: number;
};

function parseMpegHeaderAt(buf: Buffer, i: number): MpegHeader | null {
  if (i + 4 > buf.length) return null;
  const b1 = buf[i]!;
  const b2 = buf[i + 1]!;
  const b3 = buf[i + 2]!;
  const b4 = buf[i + 3]!;

  if (b1 !== 0xff || (b2 & 0xe0) !== 0xe0) return null; // sync

  const verBits = (b2 >> 3) & 0x03;
  const layerBits = (b2 >> 1) & 0x03;
  if (verBits === 1 || layerBits === 0) return null; // reserved

  const version = verBits === 3 ? 1 : verBits === 2 ? 2 : 25;
  const layer = layerBits === 3 ? 1 : layerBits === 2 ? 2 : 3;

  const bitrateIdx = (b3 >> 4) & 0x0f;
  const sampleIdx = (b3 >> 2) & 0x03;
  const padding = ((b3 >> 1) & 0x01) as 0 | 1;

  const chanMode = (b4 >> 6) & 0x03;
  const channels = chanMode === 3 ? 1 : 2;

  const baseRates = [44100, 48000, 32000] as const;
  if (sampleIdx === 3) return null;
  let sampleRate = baseRates[sampleIdx]!;
  if (version === 2) sampleRate >>= 1;
  if (version === 25) sampleRate >>= 2;

  const br = {
    1: {
      1: [
        0, 32, 64, 96, 128, 160, 192, 224, 256, 288, 320, 352, 384, 416, 448, 0,
      ],
      2: [0, 32, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 384, 0],
      3: [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0],
    },
    2: {
      1: [0, 32, 48, 56, 64, 80, 96, 112, 128, 144, 160, 176, 192, 224, 256, 0],
      2: [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0],
      3: [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0],
    },
    25: {
      1: [0, 32, 48, 56, 64, 80, 96, 112, 128, 144, 160, 176, 192, 224, 256, 0],
      2: [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0],
      3: [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0],
    },
  } as const;

  const bitrateKbps = br[version][layer][bitrateIdx]!;
  if (!bitrateKbps) return null;

  let samplesPerFrame: number;
  if (layer === 1) samplesPerFrame = 384;
  else if (layer === 2) samplesPerFrame = 1152;
  else samplesPerFrame = version === 1 ? 1152 : 576; // Layer III

  let frameLengthBytes: number;
  if (layer === 1) {
    frameLengthBytes = Math.floor(
      ((12 * bitrateKbps * 1000) / sampleRate + padding) * 4
    );
  } else {
    const coef = version === 1 ? 144 : 72; // L2/L3
    frameLengthBytes = Math.floor(
      (coef * bitrateKbps * 1000) / sampleRate + padding
    );
  }

  if (frameLengthBytes < 24) return null;

  return {
    version,
    layer,
    bitrateKbps,
    sampleRate,
    padding,
    channels,
    samplesPerFrame,
    frameLengthBytes,
  };
}

function tryXingVBRI(buf: Buffer, start: number, h: MpegHeader): number | null {
  // After header comes side info for Layer III; depends on version & channels
  let sideInfoLen = 0;
  if (h.layer === 3) {
    if (h.version === 1) sideInfoLen = h.channels === 1 ? 17 : 32;
    else sideInfoLen = h.channels === 1 ? 9 : 17;
  }
  const xingOff = start + 4 + sideInfoLen;
  if (xingOff + 16 <= buf.length) {
    const tag = buf.slice(xingOff, xingOff + 4).toString("ascii");
    if (tag === "Xing" || tag === "Info") {
      const flags = readUInt32BE(buf, xingOff + 4);
      if (flags & 0x0001) {
        const frames = readUInt32BE(buf, xingOff + 8);
        const seconds = (frames * h.samplesPerFrame) / h.sampleRate;
        return Math.round(seconds * 1000);
      }
    }
  }
  const vbriOff = start + 4 + 32;
  if (
    vbriOff + 26 <= buf.length &&
    buf.slice(vbriOff, vbriOff + 4).toString("ascii") === "VBRI"
  ) {
    const frames = readUInt32BE(buf, vbriOff + 14);
    const seconds = (frames * h.samplesPerFrame) / h.sampleRate;
    return Math.round(seconds * 1000);
  }
  return null;
}

function mp3DurationMs(buf: Buffer): number {
  let i = skipID3v2(buf);

  // Find first MPEG frame
  while (i + 4 < buf.length) {
    const h = parseMpegHeaderAt(buf, i);
    if (h) {
      // If present, use Xing/Info or VBRI headers for accurate VBR duration
      const vbrMs = tryXingVBRI(buf, i, h);
      if (vbrMs != null) return vbrMs;

      // Fallback: scan frames (works for CBR and most VBR)
      let totalSamples = 0;
      let pos = i;
      let safety = 0;
      while (pos + 4 <= buf.length && safety < 2_000_000) {
        const hh = parseMpegHeaderAt(buf, pos);
        if (!hh) break;
        totalSamples += hh.samplesPerFrame;
        pos += hh.frameLengthBytes;
        safety += 1;
      }
      const seconds = totalSamples / h.sampleRate;
      return Math.max(0, Math.round(seconds * 1000));
    }
    i++;
  }
  throw new Error("No MPEG frame found");
}

async function getAudioDurationMs(buf: Buffer, mime?: string) {
  if (mime === "audio/mpeg") return mp3DurationMs(buf);
  return wavDurationMs(buf);
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
  // default to MP3 for TTS
  return "audio/mpeg";
}
