import { PutObjectCommand } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { TRPCError } from "@trpc/server";
import ffmpegStatic from "ffmpeg-static";
import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { PassThrough, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import z from "zod";
import { env } from "../env";
import { client } from "../queue/client";
import { s3Client } from "../s3";
import { TASK_NAMES } from "../server";
import { createTRPCRouter, queueProcedure } from "../trpc";
import { testWorkersRouter } from "./testWorkers";
import { aiWorkerRouter } from "./workers/ai";

import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import type { ReadableStream as NodeWebReadableStream } from "node:stream/web";
import pLimit from "p-limit";
/* ─────────────────────────────────────────────────────────────────────────────
   Schemas
   ──────────────────────────────────────────────────────────────────────────── */

export const audioChunkInput = z.object({ id: z.string().uuid() });
export const processAudioFileInput = z.object({ id: z.string().uuid() });
export const concatAudioFileInput = z.object({
  id: z.string().uuid(),
  overwrite: z.boolean().optional().default(false),
});
export const createAudioFileChunksInput = z.object({
  audioFileId: z.string().uuid(),
  chunkSize: z.number().min(1).max(2000),
});

/* ─────────────────────────────────────────────────────────────────────────────
   Router
   ──────────────────────────────────────────────────────────────────────────── */

export const workersRouter = createTRPCRouter({
  ai: aiWorkerRouter,
  test: testWorkersRouter,

  // ────────────────────────────────────────────────────────────────────────────
  // Concat via demuxer (single input) after transcoding all chunks to WAV.
  // Silence padding generated as WAV -> concat -> encode MP3.
  // Uses streaming IO and conservative multipart to avoid OOM/SIGKILL.
  // ────────────────────────────────────────────────────────────────────────────
  concatAudioFile: queueProcedure
    .input(concatAudioFileInput)
    .mutation(async ({ ctx, input }) => {
      const startTime = Date.now();

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
      if (chunks.some((c) => !c.url)) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "One or more chunks missing URL",
        });
      }

      // 2) Output configuration
      const bucket = env.NEXT_PUBLIC_CLOUD_FLARE_AUDIO_BUCKET_NAME;
      const finalKey = `audio/${audioFile.id}.mp3`;
      const finalUrl = `${env.NEXT_PUBLIC_AUDIO_BUCKET_URL}/${finalKey}`;

      // 3) Prefetch & TRANSCODE each chunk to WAV (streamed; no big buffers)
      const tmpDir = await mkdtemp(path.join(os.tmpdir(), "concat-"));
      const INPUT_PREFETCH_CONCURRENCY = Number(
        process.env.CONCAT_PREFETCH_CONCURRENCY || 8
      );
      const limit = pLimit(INPUT_PREFETCH_CONCURRENCY);

      const sampleRate = 24000;
      const listPath = path.join(tmpDir, "list.ffconcat");

      let localInputsWav: string[] = [];
      try {
        localInputsWav = await Promise.all(
          chunks.map((c, i) =>
            limit(async () => {
              const url = c.url!;
              const srcPath = path.join(
                tmpDir,
                `${String(i).padStart(6, "0")}.mp3`
              );
              const wavPath = path.join(
                tmpDir,
                `${String(i).padStart(6, "0")}.wav`
              );

              // Stream download to disk
              const res = await fetch(url);
              if (!res.ok || !res.body)
                throw new Error(`fetch ${i} ${res.status}`);
              const webBody =
                res.body as unknown as NodeWebReadableStream<Uint8Array>;
              const nodeBody = Readable.fromWeb(webBody);

              await pipeline(
                nodeBody,
                createWriteStream(srcPath, { flags: "w" })
              );

              // Transcode MP3 -> WAV 24kHz mono (s16le)
              await new Promise<void>((resolve, reject) => {
                const p = spawn((ffmpegStatic as string) || "ffmpeg", [
                  "-hide_banner",
                  "-loglevel",
                  "error",
                  "-nostdin",
                  "-i",
                  srcPath,
                  "-ar",
                  String(sampleRate),
                  "-ac",
                  "1",
                  "-f",
                  "wav",
                  wavPath,
                ]);
                p.on("close", (code) =>
                  code === 0
                    ? resolve()
                    : reject(new Error(`ffmpeg wav transcode exited ${code}`))
                );
              });

              return wavPath;
            })
          )
        );
      } catch (e) {
        await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed prefetch/transcode inputs: ${(e as Error).message}`,
        });
      }

      // 4) Build ffconcat list with SILENCE WAVs (lead/gaps/tail)
      const SILENCE_SR = sampleRate;
      const SILENCE_CH = 1;
      const silenceCache = new Map<number, string>();

      async function writeSilenceWavStreamed(pth: string, ms: number) {
        const secs = Math.max(0, ms) / 1000;
        const numSamples = Math.round(SILENCE_SR * secs);
        const dataBytes = numSamples * SILENCE_CH * 2; // s16le

        // WAV header
        const hdr = Buffer.alloc(44);
        hdr.write("RIFF", 0, "ascii");
        hdr.writeUInt32LE(36 + dataBytes, 4);
        hdr.write("WAVEfmt ", 8, "ascii");
        hdr.writeUInt32LE(16, 16);
        hdr.writeUInt16LE(1, 20); // PCM
        hdr.writeUInt16LE(SILENCE_CH, 22);
        hdr.writeUInt32LE(SILENCE_SR, 24);
        const byteRate = SILENCE_SR * SILENCE_CH * 2;
        hdr.writeUInt32LE(byteRate, 28);
        hdr.writeUInt16LE(SILENCE_CH * 2, 32);
        hdr.writeUInt16LE(16, 34);
        hdr.write("data", 36, "ascii");
        hdr.writeUInt32LE(dataBytes, 40);

        await new Promise<void>((resolve, reject) => {
          const ws = createWriteStream(pth, { flags: "w" });
          ws.once("error", reject);
          ws.write(hdr);

          const zeroChunk = Buffer.allocUnsafe(64 * 1024);
          zeroChunk.fill(0);
          let remaining = dataBytes;

          function writeMore() {
            while (remaining > 0) {
              const toWrite = Math.min(remaining, zeroChunk.length);
              const ok = ws.write(zeroChunk.subarray(0, toWrite));
              remaining -= toWrite;
              if (!ok) {
                ws.once("drain", writeMore);
                return;
              }
            }
            ws.end();
          }
          ws.once("finish", resolve);
          writeMore();
        });
      }

      async function getSilencePath(ms: number) {
        const dur = Math.max(0, Math.round(ms));
        if (dur === 0) return null;
        if (!silenceCache.has(dur)) {
          const p = path.join(tmpDir, `silence_${dur}.wav`);
          await writeSilenceWavStreamed(p, dur);
          silenceCache.set(dur, p);
        }
        return silenceCache.get(dur)!;
      }

      let list = "ffconcat version 1.0\n";
      for (let i = 0; i < chunks.length; i++) {
        const c = chunks[i]!;
        const isFirst = i === 0;
        const isLast = i === chunks.length - 1;

        const startMs = Math.max(0, c.paddingStartMs ?? 0);
        const endMs = Math.max(0, c.paddingEndMs ?? 0);

        if (isFirst && startMs) {
          const s = await getSilencePath(startMs);
          if (s) list += `file '${s}'\n`;
        }

        list += `file '${localInputsWav[i]}'\n`;

        if (!isLast) {
          const next = chunks[i + 1]!;
          const gapMs = Math.max(
            0,
            (c.paddingEndMs ?? 0) + (next.paddingStartMs ?? 0)
          );
          if (gapMs) {
            const s = await getSilencePath(gapMs);
            if (s) list += `file '${s}'\n`;
          }
        }

        if (isLast && endMs) {
          const s = await getSilencePath(endMs);
          if (s) list += `file '${s}'\n`;
        }
      }
      await writeFile(listPath, list);

      // 5) FFmpeg: concat demuxer (all WAV) -> encode MP3 96k CBR mono 24kHz
      const ffArgs: string[] = [
        "-hide_banner",
        "-loglevel",
        "warning",
        "-nostdin",
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        listPath,
        "-ar",
        String(sampleRate),
        "-ac",
        "1",
        "-c:a",
        "libmp3lame",
        "-b:a",
        "96k",
        "-f",
        "mp3",
        "pipe:1",
      ];

      // 6) Stream to R2 with conservative memory
      const DEFAULT_PART = 8 * 1024 * 1024; // 8MB
      const DEFAULT_Q = 6; // good for ~4GB containers
      const PART_SIZE = Math.max(
        5 * 1024 * 1024,
        Number(process.env.R2_PART_SIZE || DEFAULT_PART)
      );
      const QUEUE_SIZE = Math.max(
        1,
        Number(process.env.R2_QUEUE_SIZE || DEFAULT_Q)
      );

      const ff = spawn((ffmpegStatic as string) || "ffmpeg", ffArgs, {
        stdio: ["ignore", "pipe", "pipe"],
      });

      // Rolling stderr (small)
      console.log(`[${Date.now() - startTime}ms] Monitoring FFmpeg stderr...`);
      let errBuf = "";
      ff.stderr?.on("data", (d) => {
        errBuf += String(d);
        if (errBuf.length > 64_000) errBuf = errBuf.slice(-64_000);
      });
      ff.on("error", (err) => console.error("[ffmpeg] process error:", err));

      // Count bytes (no additional buffering)
      let totalBytes = 0;
      const counter = new Transform({
        highWaterMark: PART_SIZE,
        transform(chunk, _enc, cb) {
          totalBytes += (chunk as Buffer).length;
          cb(null, chunk);
        },
      });

      const pass = new PassThrough({ highWaterMark: PART_SIZE });

      const upload = new Upload({
        client: s3Client,
        queueSize: QUEUE_SIZE,
        partSize: PART_SIZE,
        leavePartsOnError: false,
        params: {
          Bucket: bucket,
          Key: finalKey,
          Body: pass,
          ContentType: "audio/mpeg",
          Metadata: {
            "x-concat-chunks": String(chunks.length),
            "x-concat-duration": String(audioFile.durationMs || 0),
          },
        },
      });

      try {
        const pipePromise = pipeline(ff.stdout!, counter, pass);
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
        errBuf = "";
        ff.removeAllListeners();
        ff.stdout?.removeAllListeners();
        ff.stderr?.removeAllListeners();
        await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
      }

      // 7) Update DB
      await ctx.db.audioFile.update({
        where: { id: audioFile.id },
        data: { status: "PROCESSED" },
      });

      console.log(
        `[concat] done in ${Date.now() - startTime}ms, wrote ~${(totalBytes / (1024 * 1024)).toFixed(1)} MB`
      );

      return { key: finalKey, url: finalUrl };
    }),

  // ────────────────────────────────────────────────────────────────────────────
  // (unchanged) processAudioChunkWithInworld / processAudioFile / createAudioFileChunks
  // ────────────────────────────────────────────────────────────────────────────
  processAudioChunkWithInworld: queueProcedure
    .input(audioChunkInput)
    .mutation(async ({ ctx, input }) => {
      const audioChunk = await ctx.db.audioChunk.findUnique({
        where: { id: input.id },
        include: {
          audioFile: {
            include: {
              _count: { select: { AudioChunks: true } },
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
      } catch (err: unknown) {
        console.error("Error calling Inworld TTS API:", err);
        await ctx.db.audioChunk.update({
          where: { id: audioChunk.id },
          data: { status: "ERROR" },
        });
        throw new TRPCError({
          code: "BAD_GATEWAY",
          message: `Could not reach Inworld TTS API: ${err instanceof Error ? err.message : String(err)}`,
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

      // Parse & measure
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
        if (audioBuffer.length < 100)
          throw new Error(
            `Buffer too small to be audio (${audioBuffer.length} bytes)`
          );
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
          message: `Failed to parse Inworld TTS API response: ${err instanceof Error ? err.message : String(err)}`,
        });
      }

      // Upload to S3
      const key = `audio/${audioChunk.audioFileId}/chunks/${String(audioChunk.sequence).padStart(7, "0")}.mp3`;

      try {
        const put = new PutObjectCommand({
          Bucket: env.NEXT_PUBLIC_CLOUD_FLARE_AUDIO_BUCKET_NAME,
          Key: key,
          Body: audioBuffer!,
          ContentType: "audio/mpeg",
        });
        await s3Client.send(put);
      } catch (err) {
        console.error("S3 upload error:", err);
        await ctx.db.audioChunk.update({
          where: { id: audioChunk.id },
          data: { status: "ERROR" },
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `ERROR to upload audio to storage: ${err instanceof Error ? err.message : String(err)}`,
        });
      } finally {
        audioBuffer = undefined;
      }

      // Save + recompute totals / enqueue concat (unchanged)
      await ctx.db.audioChunk.update({
        where: { id: audioChunk.id },
        data: {
          status: "PROCESSED",
          url: env.NEXT_PUBLIC_AUDIO_BUCKET_URL + "/" + key,
          durationMs: Math.max(0, Math.round(durationMs)),
        },
      });

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
        const task = client.createTask(TASK_NAMES.concatAudioFile);
        await task.applyAsync([
          { id: audioChunk.audioFileId, overwrite: true } as z.infer<
            typeof concatAudioFileInput
          >,
        ]);
      }

      return {};
    }),

  processAudioFile: queueProcedure
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
        if (i + BATCH_SIZE < chunks.length)
          await new Promise((r) => setTimeout(r, 5000));
      }
      return {};
    }),

  createAudioFileChunks: queueProcedure
    .input(createAudioFileChunksInput)
    .mutation(async ({ ctx, input }) => {
      const audioFile = await ctx.db.audioFile.findUniqueOrThrow({
        where: { id: input.audioFileId },
      });

      const splitIntoSentences = (raw: string): string[] => {
        const text = raw.replace(/\s+/g, " ").trim();
        if (!text) return [];
        try {
          if (typeof Intl !== "undefined" && (Intl as any).Segmenter) {
            const seg = new (Intl as any).Segmenter("en", {
              granularity: "sentence",
            });
            const out: string[] = [];
            for (const { segment } of seg.segment(text)) {
              const s = String(segment).trim();
              if (s) out.push(s);
            }
            if (out.length) return out;
          }
        } catch {}
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
          const pieces = softWrap(s0, limit);
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

      const filtered = chunkTexts.filter((c) => c.length > 0);
      const batchSize = 50;
      for (let i = 0; i < filtered.length; i += batchSize) {
        const batch = filtered.slice(i, i + batchSize);
        await Promise.all(
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
      }

      const task = client.createTask(TASK_NAMES.processAudioFile);
      task.applyAsync([
        { id: audioFile.id } satisfies z.infer<typeof processAudioFileInput>,
      ]);

      if (audioFile.ownerId) {
        await ctx.db.credits.update({
          where: { userId: audioFile.ownerId },
          data: { amount: { decrement: audioFile.text.length } },
        });
      }
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
  const b1 = buf[i]!,
    b2 = buf[i + 1]!,
    b3 = buf[i + 2]!,
    b4 = buf[i + 3]!;
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

      let totalSamples = 0,
        pos = i,
        safety = 0;
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
