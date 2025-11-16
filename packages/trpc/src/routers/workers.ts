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
import { forceGarbageCollection } from "../lib/garbage";
import { detectMime, getAudioDurationMs } from "../lib/utils/audio";
import {
  buildChunks,
  createChunksFromChapters,
  sectionType,
  splitIntoSentences,
} from "../lib/utils/chunking";
import { enqueueTask } from "../queue/enqueue";

export const audioChunkInput = z.object({ id: z.string().uuid() });
export const processAudioFileInput = z.object({ id: z.string().uuid() });
export const concatAudioFileInput = z.object({
  id: z.string().uuid(),
  overwrite: z.boolean().optional().default(false),
});
export const createAudioFileChunksInput = z.object({
  audioFileId: z.string().uuid(),
  chunkSize: z.number().min(1).max(2000),
  includeTitle: z.boolean().optional().default(true),
});
export const createAudioFileChunksFromChaptersInput = z.object({
  audioFileId: z.string().uuid(),
  chapters: z.array(
    z.object({
      title: z.string(),
      type: sectionType,
      text: z.string(),
    })
  ),
});

export type AudioChunkInput = z.infer<typeof audioChunkInput>;
export type ProcessAudioFileInput = z.infer<typeof processAudioFileInput>;
export type ConcatAudioFileInput = z.infer<typeof concatAudioFileInput>;
export type CreateAudioFileChunksInput = z.infer<
  typeof createAudioFileChunksInput
>;
export type CreateAudioFileChunksFromChaptersInput = z.infer<
  typeof createAudioFileChunksFromChaptersInput
>;

export const workersRouter = createTRPCRouter({
  ai: aiWorkerRouter,
  test: testWorkersRouter,

  concatAudioFile: queueProcedure
    .input(concatAudioFileInput)
    .mutation(async ({ ctx, input }) => {
      const startTime = Date.now();

      // 1) Load file + chunks
      const audioFile = await ctx.db.audioFile.findUnique({
        where: { id: input.id },
        select: {
          id: true,
          durationMs: true,
          AudioChunks: { orderBy: { sequence: "asc" } },
        },
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

      forceGarbageCollection();

      console.log(
        `[concat] done in ${Date.now() - startTime}ms, wrote ~${(totalBytes / (1024 * 1024)).toFixed(1)} MB`
      );

      return { key: finalKey, url: finalUrl };
    }),

  processAudioChunkWithInworld: queueProcedure
    .input(audioChunkInput)
    .mutation(async ({ ctx, input }) => {
      const audioChunk = await ctx.db.audioChunk.findUnique({
        where: { id: input.id },
        include: {
          audioFile: {
            select: {
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

        await enqueueTask(TASK_NAMES.audio.concatAudioFile, {
          id: audioChunk.audioFileId,
          overwrite: true,
        });
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
        select: { id: true },
      });

      const BATCH_SIZE = 15;
      for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
        const batch = chunks.slice(i, i + BATCH_SIZE);
        await Promise.all(
          batch.map((chunk) => {
            return enqueueTask(TASK_NAMES.audio.processAudioChunkWithInworld, {
              id: chunk.id,
            });
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
        include: { speaker: true },
      });

      // Optionally create title chunk
      const includeTitle = input.includeTitle ?? true;
      if (includeTitle) {
        await ctx.db.audioChunk.create({
          data: {
            audioFileId: audioFile.id,
            text: `${audioFile.name}, narrated by ${audioFile.speaker.displayName}.`,
            sequence: 0,
            paddingEndMs: 2000,
          },
        });
      }

      const sentences = splitIntoSentences(audioFile.text);
      const chunkTexts = buildChunks(sentences, input.chunkSize);

      const filtered = chunkTexts.filter((c) => c.length > 0);
      const batchSize = 50;
      const sequenceOffset = includeTitle ? 1 : 0;
      for (let i = 0; i < filtered.length; i += batchSize) {
        const batch = filtered.slice(i, i + batchSize);
        await Promise.all(
          batch.map((c, j) => {
            return ctx.db.audioChunk.create({
              data: {
                audioFileId: audioFile.id,
                text: c,
                sequence: i + j + sequenceOffset,
                paddingEndMs: 550,
              },
            });
          })
        );
      }

      await enqueueTask(TASK_NAMES.audio.processAudioFile, {
        id: audioFile.id,
      });

      if (audioFile.ownerId) {
        await ctx.db.$transaction(async (tx) => {
          await tx.creditTransaction.create({
            data: {
              userId: audioFile.ownerId!,
              amount: -audioFile.text.length,
              reason: "tts_usage",
              description: `TTS usage for audio file ${audioFile.id} (${audioFile.name || "untitled"}) - ${audioFile.text.length} characters`,
            },
          });
          await tx.credits.update({
            where: { userId: audioFile.ownerId! },
            data: { amount: { decrement: audioFile.text.length } },
          });
        });
      }
      return {};
    }),

  createAudioFileChunksFromChapters: queueProcedure
    .input(createAudioFileChunksFromChaptersInput)
    .mutation(async ({ ctx, input }) => {
      const audioFile = await ctx.db.audioFile.findUniqueOrThrow({
        where: { id: input.audioFileId },
        include: { speaker: true },
      });

      // Create title chunk
      await ctx.db.audioChunk.create({
        data: {
          audioFileId: audioFile.id,
          text: `${audioFile.name}, narrated by ${audioFile.speaker.displayName}.`,
          sequence: 0,
          paddingEndMs: 2000,
        },
      });

      const chunks = createChunksFromChapters({ chapters: input.chapters });

      const batchSize = 50;
      for (let i = 0; i < chunks.length; i += batchSize) {
        const batch = chunks.slice(i, i + batchSize);
        await Promise.all(
          batch.map((c, j) => {
            return ctx.db.audioChunk.create({
              data: {
                audioFileId: audioFile.id,
                text: c.text,
                sequence: c.sequence + 1,
                paddingEndMs: c.paddingEndMs,
              },
            });
          })
        );
      }

      await enqueueTask(TASK_NAMES.audio.processAudioFile, {
        id: audioFile.id,
      });

      if (audioFile.ownerId) {
        await ctx.db.$transaction(async (tx) => {
          await tx.creditTransaction.create({
            data: {
              userId: audioFile.ownerId!,
              amount: -audioFile.text.length,
              reason: "tts_usage",
              description: `TTS usage for audio file ${audioFile.id} (${audioFile.name || "untitled"}) - ${audioFile.text.length} characters`,
            },
          });
          await tx.credits.update({
            where: { userId: audioFile.ownerId! },
            data: { amount: { decrement: audioFile.text.length } },
          });
        });
      }
      return {};
    }),
});
