// ──────────────────────────────────────────────────────────────────────────────
// File: components/AudioPlayer.tsx (updated)
// ──────────────────────────────────────────────────────────────────────────────

"use client";

import { api } from "@/trpc/react";
import { useQuery } from "@tanstack/react-query";
import { AudioFile } from "@workspace/database";
import { Button } from "@workspace/ui/components/button";
import { Slider } from "@workspace/ui/components/slider";
import { Loader2Icon, PauseIcon, PlayIcon } from "lucide-react/icons";
import React, { useEffect, useMemo, useRef, useState } from "react";

// ──────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────

interface AudioPlayerProps {
  af: AudioFile; // ⚠️ prop renamed per request
}

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

const clamp = (n: number, min: number, max: number) =>
  Math.min(Math.max(n, min), max);

const formatTime = (sec: number) => {
  const s = Math.max(0, Math.floor(sec || 0));
  const mm = Math.floor(s / 60)
    .toString()
    .padStart(2, "0");
  const ss = Math.floor(s % 60)
    .toString()
    .padStart(2, "0");
  return `${mm}:${ss}`;
};

/**
 * Encode a contiguous WAV from a list of AudioBuffers.
 * Progressively builds the PCM and yields to the browser so we can
 * update a percentage (smooth loading state during "stitching").
 */
async function encodeWAVProgressive(
  buffers: AudioBuffer[],
  onProgress?: (p: number) => void
): Promise<Blob> {
  if (!buffers.length) throw new Error("No buffers to encode.");

  const first = buffers[0]!;
  const numChannels = first.numberOfChannels;
  const sampleRate = first.sampleRate;
  const totalFrames = buffers.reduce((s, b) => s + b.length, 0);
  const byteLength = 44 + totalFrames * numChannels * 2; // 16-bit PCM
  const view = new DataView(new ArrayBuffer(byteLength));

  // header
  const writeString = (off: number, str: string) => {
    for (let i = 0; i < str.length; i++)
      view.setUint8(off + i, str.charCodeAt(i));
  };
  writeString(0, "RIFF");
  view.setUint32(4, 36 + totalFrames * numChannels * 2, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * 2, true);
  view.setUint16(32, numChannels * 2, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, totalFrames * numChannels * 2, true);

  const CHUNK_FRAMES = 16384; // encode in slices to keep UI responsive
  let globalFrame = 0;
  let writeOffset = 44; // PCM starts after header

  for (const buf of buffers) {
    const length = buf.length;
    // cache channel pointers for speed
    const channels: Float32Array[] = [];
    for (let ch = 0; ch < numChannels; ch++)
      channels[ch] = buf.getChannelData(ch);

    for (let base = 0; base < length; base += CHUNK_FRAMES) {
      const end = Math.min(base + CHUNK_FRAMES, length);

      // Interleave
      for (let i = base; i < end; i++) {
        for (let ch = 0; ch < numChannels; ch++) {
          const sample = channels[ch]![i] ?? 0;
          const s = Math.max(-1, Math.min(1, sample));
          const int16 = s < 0 ? s * 0x8000 : s * 0x7fff;
          view.setInt16(writeOffset, int16, true);
          writeOffset += 2;
        }
      }

      globalFrame += end - base;

      // Progress + yield
      if (onProgress) onProgress(globalFrame / totalFrames);
      // Yield to event loop so React can repaint
      await new Promise((r) => setTimeout(r, 0));
    }
  }

  return new Blob([view.buffer], { type: "audio/wav" });
}

// ──────────────────────────────────────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────────────────────────────────────

/**
 * AudioPlayer
 *
 * - Accepts an AudioFile (`af`) prop.
 * - Loads all audio chunks for the file, decodes them, and stitches them into a single WAV.
 * - Shows a percentage "loading" state while:
 *    1) chunks are decoding, and
 *    2) the final WAV is being stitched (progress updates asynchronously).
 * - Simple play/pause + scrub slider.
 */
const AudioPlayer: React.FC<AudioPlayerProps> = ({ af }) => {
  // ──────────────────────────────────────────────────────────────────────────
  // State
  // ──────────────────────────────────────────────────────────────────────────
  const [isPlaying, setIsPlaying] = useState(false);
  const [trackProgress, setTrackProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  // Loading state (0–100)
  const [decodeProgress, setDecodeProgress] = useState(0); // 0..1
  const [stitchProgress, setStitchProgress] = useState(0); // 0..1
  const [isBuilding, setIsBuilding] = useState(false);

  const loadingPercent = useMemo(() => {
    // 80% weight to "decode all chunks", last 20% to "stitching"
    const decodePct = Math.round((decodeProgress || 0) * 80);
    const stitchPct = Math.round((stitchProgress || 0) * 20);
    // If we haven't started stitching yet, just show decode progress
    if (!isBuilding && stitchProgress === 0) return clamp(decodePct, 0, 99);
    return clamp(decodePct + stitchPct, 0, 99);
  }, [decodeProgress, stitchProgress, isBuilding]);

  // Audio element + stitched URL
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const stitchedUrlRef = useRef<string | null>(null);

  // Decoding
  const audioCtxRef = useRef<AudioContext | null>(null);
  const buffersRef = useRef<Map<number, AudioBuffer>>(new Map());
  const decodedCountRef = useRef(0);

  // Scrub helpers
  const isScrubbingRef = useRef(false);
  const wasPlayingBeforeScrubRef = useRef(false);

  // ──────────────────────────────────────────────────────────────────────────
  // Fetch chunk metadata for this audio file
  // ──────────────────────────────────────────────────────────────────────────
  const audioFileQuery = api.audio.chunks.fetchAll.useQuery(
    { audioFileId: af.id },
    {
      refetchInterval: (data) => {
        const chunks = data.state.data?.audioFile?.AudioChunks ?? [];
        const allDone =
          chunks.length > 0 &&
          chunks.every((c: any) => c.status === "PROCESSED");
        return allDone ? false : 500;
      },
    }
  );

  const chunks = useMemo(
    () =>
      (audioFileQuery.data?.audioFile.AudioChunks ?? [])
        .slice()
        .sort((a: any, b: any) => a.sequence - b.sequence),
    [audioFileQuery.data]
  );

  const totalCount = chunks.length;

  // ──────────────────────────────────────────────────────────────────────────
  // Fetch WAV parts (limited concurrency) → arrayBuffers
  // ──────────────────────────────────────────────────────────────────────────
  const wavFilesQuery = useQuery({
    queryKey: [
      "audio-buffers",
      af.id,
      (chunks || [])
        .map((c) => c.url)
        .filter(Boolean)
        .sort(),
    ],
    queryFn: async () => {
      const list = chunks
        .filter((c: any) => !!c.url)
        .slice()
        .sort((a: any, b: any) => a.sequence - b.sequence);

      async function fetchWithRetry(
        url: string,
        retries = 3,
        timeoutMs = 10000
      ): Promise<ArrayBuffer | undefined> {
        for (let attempt = 0; attempt < retries; attempt++) {
          try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), timeoutMs);
            const res = await fetch(url, { signal: controller.signal });
            clearTimeout(timeout);
            if (!res.ok) throw new Error("network");
            return await res.arrayBuffer();
          } catch {
            if (attempt === retries - 1) return undefined;
            await new Promise((r) => setTimeout(r, 300));
          }
        }
        return undefined;
      }

      const CONCURRENCY = 4;
      const out: {
        arrayBuffer: ArrayBuffer;
        chunk: (typeof chunks)[number];
      }[] = [];
      let i = 0;
      while (i < list.length) {
        const batch = list.slice(i, i + CONCURRENCY);
        const res = await Promise.all(
          batch.map(async (chunk: any) => {
            const arrayBuffer = await fetchWithRetry(chunk.url!, 3, 5000);
            return arrayBuffer ? { arrayBuffer, chunk } : undefined;
          })
        );
        out.push(...(res.filter(Boolean) as any[]));
        i += CONCURRENCY;
      }
      return out.sort((a, b) => a.chunk.sequence - b.chunk.sequence);
    },
    enabled: !!audioFileQuery.data,
    staleTime: 10_000,
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Init/teardown AudioContext
  // ──────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const ctx = new (window.AudioContext ||
      (window as any).webkitAudioContext)();
    audioCtxRef.current = ctx;
    return () => {
      ctx.close();
      audioCtxRef.current = null;
      buffersRef.current.clear();
    };
  }, []);

  // ──────────────────────────────────────────────────────────────────────────
  // Decode fetched WAVs → AudioBuffers (update decode progress live)
  // ──────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const ctx = audioCtxRef.current;
      if (!ctx || !wavFilesQuery.data?.length) return;

      let didChange = false;
      const total = totalCount || wavFilesQuery.data.length;
      for (const { arrayBuffer, chunk } of wavFilesQuery.data) {
        if (buffersRef.current.has(chunk.sequence)) continue;
        try {
          const decoded = await ctx.decodeAudioData(arrayBuffer.slice(0));
          if (decoded) {
            buffersRef.current.set(chunk.sequence, decoded);
            decodedCountRef.current += 1;
            didChange = true;
            setDecodeProgress(decodedCountRef.current / Math.max(1, total));
          }
        } catch {
          // ignore decode failures; leave as not-ready
        }
      }

      if (didChange) {
        // When all decoded, we can start stitching
        const haveAll = chunks.every((c: any) =>
          buffersRef.current.has(c.sequence)
        );
        if (haveAll) {
          await ensureStitchedUrl();
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wavFilesQuery.data, totalCount, af.id]);

  // ──────────────────────────────────────────────────────────────────────────
  // Build stitched WAV when all chunks are decoded (progressive)
  // ──────────────────────────────────────────────────────────────────────────
  const ensureStitchedUrl = async (): Promise<string | null> => {
    if (stitchedUrlRef.current) return stitchedUrlRef.current;

    const allProcessed =
      chunks.length > 0 &&
      chunks.every((c: any) => c.status === "PROCESSED") &&
      chunks.every((c: any) => buffersRef.current.has(c.sequence));

    if (!allProcessed) return null;

    setIsBuilding(true);
    setStitchProgress(0);

    try {
      const ordered = chunks
        .slice()
        .sort((a: any, b: any) => a.sequence - b.sequence)
        .map((c: any) => buffersRef.current.get(c.sequence))
        .filter((b): b is AudioBuffer => !!b);

      const wavBlob = await encodeWAVProgressive(ordered, (p) =>
        setStitchProgress(p)
      );

      const url = URL.createObjectURL(wavBlob);
      stitchedUrlRef.current = url;

      // Create/refresh audio element
      let el = audioElRef.current;
      if (!el) {
        el = new Audio(url);
        el.preload = "auto";
        audioElRef.current = el;
        wireAudioEl(el);
      } else if (el.src !== url) {
        el.src = url;
      }

      return url;
    } finally {
      setIsBuilding(false);
    }
  };

  // Clean up stitched URL on unmount or af change
  useEffect(() => {
    return () => {
      try {
        audioElRef.current?.pause();
      } catch {}
      if (audioElRef.current) {
        try {
          audioElRef.current.src = "";
        } catch {}
        audioElRef.current = null;
      }
      if (stitchedUrlRef.current) {
        URL.revokeObjectURL(stitchedUrlRef.current);
        stitchedUrlRef.current = null;
      }
    };
  }, [af.id]);

  // Wire audio element events
  const wireAudioEl = (el: HTMLAudioElement) => {
    el.addEventListener("timeupdate", () => {
      if (!isScrubbingRef.current) {
        setTrackProgress(el.currentTime || 0);
      }
    });
    el.addEventListener("loadedmetadata", () => {
      const d = Number.isFinite(el.duration) ? el.duration : 0;
      setDuration(d);
    });
    el.addEventListener("ended", () => {
      setIsPlaying(false);
    });
  };

  // Keep duration in sync if we decode new buffers earlier than metadata is ready
  const expectedDuration = useMemo(() => {
    const ordered = chunks
      .slice()
      .sort((a: any, b: any) => a.sequence - b.sequence)
      .map((c: any) => buffersRef.current.get(c.sequence))
      .filter((b): b is AudioBuffer => !!b);
    const total = ordered.reduce((s, b) => s + b.duration, 0);
    return total;
  }, [chunks, decodeProgress, af.id]);

  useEffect(() => {
    if (!duration && expectedDuration) {
      setDuration(expectedDuration);
    }
  }, [expectedDuration, duration]);

  // ──────────────────────────────────────────────────────────────────────────
  // Play/Pause
  // ──────────────────────────────────────────────────────────────────────────
  const isReady = !!stitchedUrlRef.current && !isBuilding;
  useEffect(() => {
    // Try building the stitched URL as soon as possible (if ready)
    void ensureStitchedUrl();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [decodeProgress, chunks.length]);

  useEffect(() => {
    const el = audioElRef.current;
    if (!el) return;
    if (isPlaying) {
      void el.play().catch(() => setIsPlaying(false));
    } else {
      el.pause();
    }
  }, [isPlaying]);

  const togglePlay = async () => {
    if (!isReady) return;
    const el = audioElRef.current!;
    setIsPlaying((p) => {
      const next = !p;
      if (next) void el.play().catch(() => setIsPlaying(false));
      else el.pause();
      return next;
    });
  };

  // ──────────────────────────────────────────────────────────────────────────
  // Scrubbing
  // ──────────────────────────────────────────────────────────────────────────
  const handleScrubStart = () => {
    if (isScrubbingRef.current) return;
    isScrubbingRef.current = true;
    wasPlayingBeforeScrubRef.current = isPlaying;
    try {
      audioElRef.current?.pause();
    } catch {}
    setIsPlaying(false);
  };

  const handleScrubChange = (v: number) => {
    setTrackProgress(v);
  };

  const handleScrubEnd = (v: number) => {
    isScrubbingRef.current = false;
    const el = audioElRef.current;
    if (el) {
      try {
        el.currentTime = clamp(v, 0, duration || v);
      } catch {}
      setTrackProgress(el.currentTime || v);
    }
    if (wasPlayingBeforeScrubRef.current) {
      setIsPlaying(true);
    }
    wasPlayingBeforeScrubRef.current = false;
  };

  // ──────────────────────────────────────────────────────────────────────────
  // Render
  // ──────────────────────────────────────────────────────────────────────────
  const title = af.name ?? "Untitled";
  const showLoading = !isReady || (isBuilding && !isPlaying);
  const effectiveDuration = Math.max(0.01, duration || expectedDuration || 0);
  const uiProgress = clamp(trackProgress, 0, effectiveDuration);

  return (
    <div className="sm:border rounded-lg sm:p-4">
      {/* Title */}
      <h3 className="text-lg font-semibold mb-2">{title}</h3>

      {/* Controls */}
      <div className="flex-row-reverse sm:flex-row flex items-center justify-between gap-3 mb-2">
        <div className="flex-row-reverse sm:flex-row flex items-center gap-3">
          <Button
            onClick={togglePlay}
            disabled={!isReady && !showLoading}
            aria-label={isPlaying ? "Pause" : "Play"}
            aria-busy={showLoading ? true : undefined}
          >
            {isPlaying ? (
              <PauseIcon className="size-4" />
            ) : showLoading ? (
              <span className="inline-flex items-center gap-2">
                <Loader2Icon className="size-4 animate-spin" />
                <span className="text-xs tabular-nums min-w-[2.5em] inline-block">
                  {loadingPercent}%
                </span>
              </span>
            ) : (
              <PlayIcon className="size-4" />
            )}
          </Button>

          <span className="tabular-nums">
            {formatTime(uiProgress)} / {formatTime(effectiveDuration)}
          </span>
        </div>
      </div>

      {/* Unified slider */}
      <Slider
        value={[uiProgress]}
        min={0}
        max={effectiveDuration}
        step={0.01}
        onPointerDown={handleScrubStart}
        onValueChange={([v]) => v != null && handleScrubChange(v)}
        onValueCommit={([v]) => v != null && handleScrubEnd(v)}
        className="w-full h-10"
      />
    </div>
  );
};

export default AudioPlayer;
