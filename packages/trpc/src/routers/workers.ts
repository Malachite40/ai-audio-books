import { PutObjectCommand } from "@aws-sdk/client-s3";
import { TRPCError } from "@trpc/server";
import ffmpegStatic from "ffmpeg-static";
import { spawn } from "node:child_process";
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

export const concatAudioFileInput = z.object({
  id: z.string().uuid(),
  overwrite: z.boolean().optional().default(false),
});

export const workersRouter = createTRPCRouter({
  concatAudioFile: publicProcedure
    .input(concatAudioFileInput)
    .mutation(async ({ ctx, input }) => {
      // 1) Load file + chunks
      const audioFile = await ctx.db.audioFile.findUnique({
        where: { id: input.id },
        include: { AudioChunks: { orderBy: { sequence: "asc" } } },
      });

      if (!audioFile) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Audio file not found",
        });
      }

      const chunks = audioFile.AudioChunks ?? [];
      if (!chunks.length) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "No chunks to concat",
        });
      }

      if (chunks.some((c) => c.status !== "PROCESSED")) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Chunks are not all PROCESSED",
        });
      }

      // 2) Output configuration
      const bucket = env.NEXT_PUBLIC_CLOUD_FLARE_AUDIO_BUCKET_NAME;
      const finalKey = `audio/${audioFile.id}.mp3`;
      const finalUrl = `${env.NEXT_PUBLIC_AUDIO_BUCKET_URL}/${finalKey}`;

      // 3) FFmpeg configuration
      const ffmpegBin = (ffmpegStatic as string) || "ffmpeg";
      const sampleRate = 48000;
      const channelLayout = "stereo";

      // 4) Build input arguments - decode to PCM to avoid MP3 timing issues
      const args: string[] = [
        "-hide_banner",
        "-loglevel",
        "warning", // Changed to warning to reduce noise
        "-nostdin",
      ];

      chunks.forEach((c, idx) => {
        if (!c.url) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `Chunk ${c.sequence} is missing a URL`,
          });
        }
        args.push("-i", c.url);
      });

      // 5) Build filter graph - fixed padding logic and correct ordering
      const filters: string[] = [];
      const concatInputs: string[] = [];

      // First, create all normalization filters
      for (let i = 0; i < chunks.length; i++) {
        const normalized = `norm${i}`;
        filters.push(
          `[${i}:a]aformat=sample_fmts=s16:sample_rates=${sampleRate}:channel_layouts=${channelLayout}[${normalized}]`
        );
      }

      // Then build the concat sequence in the correct order
      for (let i = 0; i < chunks.length; i++) {
        const c = chunks[i]!;
        const isFirst = i === 0;
        const isLast = i === chunks.length - 1;

        // Calculate padding for this chunk
        const startMs = Math.max(0, c.paddingStartMs ?? 0);
        const endMs = Math.max(0, c.paddingEndMs ?? 0);

        // Only apply start padding to the very first chunk
        const leadPadMs = isFirst ? startMs : 0;

        // Only apply end padding to the very last chunk
        const tailMs = isLast ? endMs : 0;

        // Add lead padding if needed (BEFORE the audio chunk, only for first chunk)
        if (leadPadMs > 0) {
          const leadSilence = `lead${i}`;
          const leadSeconds = (leadPadMs / 1000).toFixed(3);
          // Generate silence using anullsrc and add tiny volume to ensure MP3 encoding
          filters.push(
            `anullsrc=r=${sampleRate}:cl=${channelLayout}:d=${leadSeconds}[${leadSilence}_raw]`
          );
          filters.push(`[${leadSilence}_raw]volume=0.001[${leadSilence}]`);
          concatInputs.push(`[${leadSilence}]`);
        }

        // Add the actual audio chunk
        concatInputs.push(`[norm${i}]`);

        // Add inter-chunk gap if there's a next chunk
        if (!isLast) {
          const nextChunk = chunks[i + 1]!;
          const gapMs = Math.max(
            0,
            (c.paddingEndMs ?? 0) + (nextChunk.paddingStartMs ?? 0)
          );

          if (gapMs > 0) {
            const gapSilence = `gap${i}`;
            const gapSeconds = (gapMs / 1000).toFixed(3);
            // Generate silence using anullsrc and add tiny volume to ensure MP3 encoding
            filters.push(
              `anullsrc=r=${sampleRate}:cl=${channelLayout}:d=${gapSeconds}[${gapSilence}_raw]`
            );
            filters.push(`[${gapSilence}_raw]volume=0.001[${gapSilence}]`);
            concatInputs.push(`[${gapSilence}]`);
          }
        }

        // Add tail padding if needed (only for last chunk, AFTER the audio)
        if (tailMs > 0) {
          const tailSilence = `tail${i}`;
          const tailSeconds = (tailMs / 1000).toFixed(3);
          // Generate silence using anullsrc and add tiny volume to ensure MP3 encoding
          filters.push(
            `anullsrc=r=${sampleRate}:cl=${channelLayout}:d=${tailSeconds}[${tailSilence}_raw]`
          );
          filters.push(`[${tailSilence}_raw]volume=0.001[${tailSilence}]`);
          concatInputs.push(`[${tailSilence}]`);
        }
      }

      // Single concat of all segments in correct order
      const numInputs = concatInputs.length;
      filters.push(
        `${concatInputs.join("")}concat=n=${numInputs}:v=0:a=1[outa]`
      );

      const filterGraph = filters.join(";");

      // 6) Output arguments - using constant bitrate for more consistent encoding of quiet sections
      const outputArgs = [
        "-filter_complex",
        filterGraph,
        "-map",
        "[outa]",
        "-c:a",
        "libmp3lame",
        "-b:a",
        "128k", // Constant bitrate instead of variable quality for better silence handling
        "-ar",
        String(sampleRate),
        "-ac",
        "2",
        "-f",
        "mp3",
        "pipe:1",
      ];

      // 7) Run FFmpeg and collect output
      const ff = spawn(ffmpegBin, [...args, ...outputArgs], {
        stdio: ["ignore", "pipe", "pipe"],
      });

      const ffmpegErrs: string[] = [];
      ff.stderr?.on("data", (d) => {
        const s = String(d);
        ffmpegErrs.push(s);
        // Log any warnings or errors
        if (s.includes("Error") || s.includes("Warning")) {
          console.error("[ffmpeg]", s.trim());
        }
      });

      ff.on("error", (err) => {
        console.error("[ffmpeg] process error:", err);
      });

      let audioBuffer: Buffer;
      try {
        // Collect the output stream into a buffer
        const [buf, exitCode] = await Promise.all([
          streamToBuffer(ff.stdout!),
          new Promise<number>((res) => ff.once("close", res)),
        ]);

        if (exitCode !== 0) {
          const msg = ffmpegErrs.join("");
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `ffmpeg exited with ${exitCode}: ${msg}`,
          });
        }

        audioBuffer = buf;
      } catch (err) {
        ff.kill("SIGKILL");
        const msg = ffmpegErrs.join("");
        console.error("Concat/Encode error:", err, msg);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Concat encode failed: ${(err as Error).message}\n${msg}`,
        });
      }

      // 8) Verify the audio buffer is valid
      if (audioBuffer.length < 1000) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Generated audio is too small: ${audioBuffer.length} bytes`,
        });
      }

      // 9) Upload to S3
      try {
        const put = new PutObjectCommand({
          Bucket: bucket,
          Key: finalKey,
          Body: audioBuffer,
          ContentType: "audio/mpeg",
          Metadata: {
            "x-concat-chunks": String(chunks.length),
            "x-concat-duration": String(audioFile.durationMs || 0),
          },
        });

        await s3Client.send(put);
        console.log(`Uploaded to S3: ${finalUrl}`);
      } catch (err) {
        console.error("S3 upload error:", err);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Upload failed: ${(err as Error).message}`,
        });
      }

      // 10) Update database status
      await ctx.db.audioFile.update({
        where: { id: audioFile.id },
        data: {
          status: "PROCESSED",
        },
      });

      return { key: finalKey, url: finalUrl };
    }),

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
      const key = `audio/${audioChunk.audioFileId}/chunks/${String(
        audioChunk.sequence
      ).padStart(7, "0")}.mp3`;

      try {
        const put = new PutObjectCommand({
          Bucket: env.NEXT_PUBLIC_CLOUD_FLARE_AUDIO_BUCKET_NAME,
          Key: key,
          Body: audioBuffer,
          ContentType: "audio/mpeg",
        });
        console.log(
          "S3 upload URL:",
          env.NEXT_PUBLIC_AUDIO_BUCKET_URL + "/" + key
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

      // Detect mime + compute precise duration
      const mime = detectMime(audioBuffer);
      const durationMs = await getAudioDurationMs(audioBuffer, mime);

      // Save chunk with RAW audio duration (no padding)
      await ctx.db.audioChunk.update({
        where: { id: audioChunk.id },
        data: {
          status: "PROCESSED",
          url: env.NEXT_PUBLIC_AUDIO_BUCKET_URL + "/" + key,
          durationMs: Math.max(0, Math.round(durationMs)),
        },
      });

      console.log(
        "Audio chunk processed successfully. Recomputing file total…"
      );

      // Recompute total duration including padding
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

      // Calculate total duration with fixed padding logic (matching concat function)
      let totalDuration = 0;
      for (let i = 0; i < allForFile.length; i++) {
        const c = allForFile[i]!;
        const isFirst = i === 0;
        const isLast = i === allForFile.length - 1;

        const chunkDuration = Math.max(0, Math.round(c.durationMs ?? 0));
        const startMs = Math.max(0, c.paddingStartMs ?? 0);
        const endMs = Math.max(0, c.paddingEndMs ?? 0);

        // Only apply start padding to the very first chunk
        const leadPadMs = isFirst ? startMs : 0;

        // Only apply end padding to the very last chunk
        const tailMs = isLast ? endMs : 0;

        totalDuration += leadPadMs + chunkDuration + tailMs;

        // Add inter-chunk gap if there's a next chunk
        if (!isLast) {
          const nextChunk = allForFile[i + 1]!;
          const gapMs = Math.max(
            0,
            (c.paddingEndMs ?? 0) + (nextChunk.paddingStartMs ?? 0)
          );
          totalDuration += gapMs;
        }
      }

      await ctx.db.audioFile.update({
        where: { id: audioChunk.audioFileId },
        data: { durationMs: totalDuration },
      });

      const statusList = allForFile.map((c) => c.status);
      const allProcessed =
        statusList.length > 0 && statusList.every((s) => s === "PROCESSED");

      if (allProcessed) {
        await ctx.db.audioFile.update({
          where: { id: audioChunk.audioFileId },
          data: { status: "PROCESSING" },
        });

        // Enqueue concat job
        const task = client.createTask(TASK_NAMES.concatAudioFile);
        await task.applyAsync([
          { id: audioChunk.audioFileId, overwrite: true } as z.infer<
            typeof concatAudioFileInput
          >,
        ]);
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

      // Process chunks in batches
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
        // Throttle between batches
        if (i + BATCH_SIZE < chunks.length) {
          await new Promise((resolve) => setTimeout(resolve, 5000));
        }
      }
      return {};
    }),
});

/* ─────────────────────────────────────────────────────────────────────────────
   Helper Functions
   ──────────────────────────────────────────────────────────────────────────── */

function streamToBuffer(readable: NodeJS.ReadableStream): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    readable.on("data", (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    readable.on("end", () => resolve(Buffer.concat(chunks)));
    readable.on("error", reject);
  });
}

function detectMime(buf: Buffer): "audio/mpeg" | "audio/wav" {
  if (
    buf.slice(0, 4).toString("ascii") === "RIFF" &&
    buf.slice(8, 12).toString("ascii") === "WAVE"
  ) {
    return "audio/wav";
  }
  if (
    buf.slice(0, 3).toString("ascii") === "ID3" ||
    (buf[0] === 0xff && (buf[1]! & 0xe0) === 0xe0)
  ) {
    return "audio/mpeg";
  }
  return "audio/mpeg";
}

function wavDurationMs(wav: Buffer): number {
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

  let offset = 12;
  while (offset + 8 <= wav.length) {
    const id = wav.toString("ascii", offset, offset + 4);
    const size = wav.readUInt32LE(offset + 4);
    if (id === "data") {
      const seconds = size / byteRate;
      return Math.round(seconds * 1000);
    }
    offset += 8 + size + (size % 2);
  }
  throw new Error("No data chunk in WAV");
}

function readUInt32BE(buf: Buffer, off: number): number {
  return (
    ((buf[off]! << 24) |
      (buf[off + 1]! << 16) |
      (buf[off + 2]! << 8) |
      buf[off + 3]!) >>>
    0
  );
}

function skipID3v2(buf: Buffer): number {
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
  version: 1 | 2 | 25;
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

  if (b1 !== 0xff || (b2 & 0xe0) !== 0xe0) return null;

  const verBits = (b2 >> 3) & 0x03;
  const layerBits = (b2 >> 1) & 0x03;
  if (verBits === 1 || layerBits === 0) return null;

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
  else samplesPerFrame = version === 1 ? 1152 : 576;

  let frameLengthBytes: number;
  if (layer === 1) {
    frameLengthBytes = Math.floor(
      ((12 * bitrateKbps * 1000) / sampleRate + padding) * 4
    );
  } else {
    const coef = version === 1 ? 144 : 72;
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

  while (i + 4 < buf.length) {
    const h = parseMpegHeaderAt(buf, i);
    if (h) {
      const vbrMs = tryXingVBRI(buf, i, h);
      if (vbrMs != null) return vbrMs;

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

async function getAudioDurationMs(buf: Buffer, mime?: string): Promise<number> {
  if (mime === "audio/mpeg") return mp3DurationMs(buf);
  return wavDurationMs(buf);
}
