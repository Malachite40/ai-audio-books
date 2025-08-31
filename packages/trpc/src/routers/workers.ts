import { PutObjectCommand } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { TRPCError } from "@trpc/server";
import ffmpegStatic from "ffmpeg-static";
import { spawn } from "node:child_process";
import { PassThrough, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import z from "zod";
import { env } from "../env";
import { generateStory } from "../lib/story-generation";
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

export const generateStoryInput = z.object({
  audioFileId: z.string().uuid(),
  prompt: z.string(),
  durationMinutes: z.number(),
});

export const createAudioFileChunksInput = z.object({
  audioFileId: z.string().uuid(),
  chunkSize: z.number().min(1).max(2000),
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
        "warning",
        "-nostdin",
      ];
      chunks.forEach((c) => {
        if (!c.url) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `Chunk ${c.sequence} is missing a URL`,
          });
        }
        args.push("-i", c.url);
      });

      // 5) Build filter graph - normalization + padding/gaps
      const filters: string[] = [];
      const concatInputs: string[] = [];

      // Normalize all inputs to a consistent format
      for (let i = 0; i < chunks.length; i++) {
        const normalized = `norm${i}`;
        filters.push(
          `[${i}:a]aformat=sample_fmts=s16:sample_rates=${sampleRate}:channel_layouts=${channelLayout}[${normalized}]`
        );
      }

      // Build the concat sequence with gaps and edge padding
      for (let i = 0; i < chunks.length; i++) {
        const c = chunks[i]!;
        const isFirst = i === 0;
        const isLast = i === chunks.length - 1;

        const startMs = Math.max(0, c.paddingStartMs ?? 0);
        const endMs = Math.max(0, c.paddingEndMs ?? 0);

        const leadPadMs = isFirst ? startMs : 0;
        const tailMs = isLast ? endMs : 0;

        // Lead padding only for the first chunk
        if (leadPadMs > 0) {
          const lead = `lead${i}`;
          const secs = (leadPadMs / 1000).toFixed(3);
          filters.push(
            `anullsrc=r=${sampleRate}:cl=${channelLayout}:d=${secs}[${lead}_raw]`
          );
          filters.push(`[${lead}_raw]volume=0.001[${lead}]`);
          concatInputs.push(`[${lead}]`);
        }

        // Actual audio chunk
        concatInputs.push(`[norm${i}]`);

        // Inter-chunk gap
        if (!isLast) {
          const next = chunks[i + 1]!;
          const gapMs = Math.max(
            0,
            (c.paddingEndMs ?? 0) + (next.paddingStartMs ?? 0)
          );
          if (gapMs > 0) {
            const gap = `gap${i}`;
            const secs = (gapMs / 1000).toFixed(3);
            filters.push(
              `anullsrc=r=${sampleRate}:cl=${channelLayout}:d=${secs}[${gap}_raw]`
            );
            filters.push(`[${gap}_raw]volume=0.001[${gap}]`);
            concatInputs.push(`[${gap}]`);
          }
        }

        // Tail padding only for the last chunk
        if (tailMs > 0) {
          const tail = `tail${i}`;
          const secs = (tailMs / 1000).toFixed(3);
          filters.push(
            `anullsrc=r=${sampleRate}:cl=${channelLayout}:d=${secs}[${tail}_raw]`
          );
          filters.push(`[${tail}_raw]volume=0.001[${tail}]`);
          concatInputs.push(`[${tail}]`);
        }
      }

      const numInputs = concatInputs.length;
      filters.push(
        `${concatInputs.join("")}concat=n=${numInputs}:v=0:a=1[outa]`
      );
      const filterGraph = filters.join(";");

      // Drop these arrays ASAP so GC can reclaim
      filters.length = 0;
      concatInputs.length = 0;

      // 6) Output arguments - constant bitrate for predictable encoding
      const outputArgs = [
        "-filter_complex",
        filterGraph,
        "-map",
        "[outa]",
        "-c:a",
        "libmp3lame",
        "-b:a",
        "128k",
        "-ar",
        String(sampleRate),
        "-ac",
        "2",
        "-f",
        "mp3",
        "pipe:1",
      ];

      // 7) Run FFmpeg and stream directly to S3 (low RAM)
      const ff = spawn(ffmpegBin, [...args, ...outputArgs], {
        stdio: ["ignore", "pipe", "pipe"],
      });

      // Keep only a small rolling window of stderr to avoid unbounded memory
      let errBuf = "";
      ff.stderr?.on("data", (d) => {
        errBuf += String(d);
        if (errBuf.length > 64_000) errBuf = errBuf.slice(-64_000);
      });

      ff.on("error", (err) => {
        console.error("[ffmpeg] process error:", err);
      });

      // Transform to count bytes BEFORE the Body stream; do NOT attach 'data' to Body.
      let totalBytes = 0;
      const counter = new Transform({
        transform(chunk, _enc, cb) {
          totalBytes += (chunk as Buffer).length;
          cb(null, chunk);
        },
      });

      // PassThrough stream that becomes the Upload Body
      const pass = new PassThrough({ highWaterMark: 1024 * 1024 }); // ~1MB chunks

      // Managed multipart upload handles streaming + checksums safely
      const upload = new Upload({
        client: s3Client,
        params: {
          Bucket: bucket,
          Key: finalKey,
          Body: pass, // S3 reads from this; we never attach 'data' listeners
          ContentType: "audio/mpeg",
          Metadata: {
            "x-concat-chunks": String(chunks.length),
            "x-concat-duration": String(audioFile.durationMs || 0),
          },
        },
      });

      try {
        // Pipe ffmpeg -> counter (counts bytes) -> pass (Body for Upload)
        const pipePromise = pipeline(ff.stdout!, counter, pass);

        // Run ffmpeg, piping, and S3 upload concurrently
        const [exitCode] = await Promise.all([
          new Promise<number>((res) => ff.once("close", res)),
          pipePromise,
          upload.done(),
        ]);

        if (exitCode !== 0) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `ffmpeg exited with ${exitCode}: ${errBuf}`,
          });
        }

        if (totalBytes < 1000) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `Generated audio is too small: ${totalBytes} bytes`,
          });
        }

        console.log(`Uploaded to S3: ${finalUrl}`);
      } catch (err) {
        try {
          ff.kill("SIGKILL");
        } catch {}
        try {
          (upload as any).abort?.();
        } catch {}
        console.error("Concat/Upload error:", err, errBuf);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Concat upload failed: ${(err as Error).message}\n${errBuf}`,
        });
      } finally {
        // Proactively drop references to help GC
        errBuf = "";
        ff.removeAllListeners();
        ff.stdout?.removeAllListeners();
        ff.stderr?.removeAllListeners();
      }

      // 8) Update database status
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

      // Parse and measure audio BEFORE uploading to minimize time retaining the buffer
      let audioBuffer: Buffer | undefined;
      let durationMs = 0;
      let mime: "audio/mpeg" | "audio/wav" = "audio/mpeg";

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

        if (audioBuffer.length < 100) {
          throw new Error(
            `Buffer too small to be audio (${audioBuffer.length} bytes)`
          );
        }

        mime = detectMime(audioBuffer);
        durationMs = await getAudioDurationMs(audioBuffer, mime);
      } catch (err) {
        console.error("Failed to parse/measure Inworld TTS API response:", err);
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

      // Upload to S3
      const key = `audio/${audioChunk.audioFileId}/chunks/${String(
        audioChunk.sequence
      ).padStart(7, "0")}.mp3`;

      try {
        const put = new PutObjectCommand({
          Bucket: env.NEXT_PUBLIC_CLOUD_FLARE_AUDIO_BUCKET_NAME,
          Key: key,
          Body: audioBuffer!, // already validated
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
      } finally {
        // Drop the large buffer reference ASAP
        audioBuffer = undefined;
      }

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

      let totalDuration = 0;
      for (let i = 0; i < allForFile.length; i++) {
        const c = allForFile[i]!;
        const isFirst = i === 0;
        const isLast = i === allForFile.length - 1;

        const chunkDuration = Math.max(0, Math.round(c.durationMs ?? 0));
        const startMs = Math.max(0, c.paddingStartMs ?? 0);
        const endMs = Math.max(0, c.paddingEndMs ?? 0);

        const leadPadMs = isFirst ? startMs : 0;
        const tailMs = isLast ? endMs : 0;

        totalDuration += leadPadMs + chunkDuration + tailMs;

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
      await ctx.db.audioFile.update({
        where: { id: input.id },
        data: { status: "PROCESSING" },
      });

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

  createAudioFileChunks: publicProcedure
    .input(createAudioFileChunksInput)
    .mutation(async ({ ctx, input }) => {
      const audioFile = await ctx.db.audioFile.findUniqueOrThrow({
        where: {
          id: input.audioFileId,
        },
      });

      const splitIntoSentences = (raw: string): string[] => {
        const text = raw.replace(/\s+/g, " ").trim();
        if (!text) return [];

        // Try Intl.Segmenter
        try {
          if (typeof Intl !== "undefined" && Intl.Segmenter) {
            const seg = new Intl.Segmenter("en", { granularity: "sentence" });
            const out: string[] = [];
            for (const { segment } of seg.segment(text)) {
              const s = String(segment).trim();
              if (s) out.push(s);
            }
            if (out.length) return out;
          }
        } catch {
          // fall through to regex
        }

        const rx = /[^.!?…]+(?:\.\.\.|[.!?]|…)+(?=\s+|$)|[^.!?…]+$/g;
        const matches = text.match(rx) ?? [];
        return matches.map((s) => s.trim());
      };

      const softWrap = (sentence: string, limit: number): string[] => {
        if (sentence.length <= limit) return [sentence];
        const words = sentence.split(/\s+/);
        const out: string[] = [];
        let buf = "";
        for (const w of words) {
          const next = buf ? `${buf} ${w}` : w;
          if (next.length > limit && buf) {
            out.push(buf);
            buf = w;
          } else {
            buf = next;
          }
        }
        if (buf) out.push(buf);
        return out;
      };

      const buildChunks = (sentences: string[], limit: number): string[] => {
        const chunks: string[] = [];
        let buf = "";

        const flush = () => {
          if (buf.trim()) chunks.push(buf.trim());
          buf = "";
        };

        for (const s0 of sentences) {
          const pieces = softWrap(s0, limit); // handle oversize sentence
          for (const s of pieces) {
            const candidate = buf ? `${buf} ${s}` : s;
            if (candidate.length > limit && buf) {
              flush();
              buf = s;
            } else {
              buf = candidate;
            }
          }
        }
        flush();
        return chunks;
      };

      const sentences = splitIntoSentences(audioFile.text);
      const chunkTexts = buildChunks(sentences, input.chunkSize);

      const allCreatedChunks = [];
      const filteredChunks = chunkTexts.filter((c) => c.length > 0);
      const batchSize = 50;
      for (let i = 0; i < filteredChunks.length; i += batchSize) {
        const batch = filteredChunks.slice(i, i + batchSize);
        const batchCreated = await Promise.all(
          batch.map((c, j) =>
            ctx.db.audioChunk.create({
              data: {
                audioFileId: audioFile.id,
                text: c,
                sequence: i + j,
                paddingEndMs: 550,
              },
            })
          )
        );
        allCreatedChunks.push(...batchCreated);
      }

      const task = client.createTask(TASK_NAMES.processAudioFile);
      task.applyAsync([
        { id: audioFile.id } satisfies z.infer<typeof processAudioFileInput>,
      ]);

      // deduct credit
      if (audioFile.ownerId) {
        await ctx.db.credits.update({
          where: { userId: audioFile.ownerId },
          data: { amount: { decrement: audioFile.text.length } },
        });
      }

      return {};
    }),

  generateStory: publicProcedure
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

      const task = client.createTask(TASK_NAMES.createAudioFileChunks);
      task.applyAsync([
        {
          audioFileId: input.audioFileId,
          chunkSize: 300,
        } satisfies z.infer<typeof createAudioFileChunksInput>,
      ]);

      return {};
    }),
});

/* ─────────────────────────────────────────────────────────────────────────────
   Helper Functions
   ──────────────────────────────────────────────────────────────────────────── */

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
    if (tag === "Xing" || "Info") {
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
