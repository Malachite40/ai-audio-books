"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";

import { api } from "@/trpc/react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@workspace/ui/components/button";
import { Slider } from "@workspace/ui/components/slider";
import { cn } from "@workspace/ui/lib/utils";

// Forms
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@workspace/ui/components/form";
import { Input } from "@workspace/ui/components/input";
import { DownloadIcon, PauseIcon, PlayIcon } from "lucide-react/icons";
import { useForm } from "react-hook-form";

import { authClient } from "@/lib/auth-client";
import { AudioFile } from "@workspace/database";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip";
import CopyButton from "../copy-button";

export interface AudioClipProps {
  af: AudioFile;
}

// ──────────────────────────────────────────────────────────────────────────────
// Schemas
// ──────────────────────────────────────────────────────────────────────────────
const PaddingAllSchema = z.object({
  paddingStartMs: z.coerce.number().min(0, "Must be ≥ 0"),
  paddingEndMs: z.coerce.number().min(0, "Must be ≥ 0"),
});

const PaddingSchema = z.object({
  paddingStartMs: z.coerce.number().min(0, "Must be ≥ 0"),
  paddingEndMs: z.coerce.number().min(0, "Must be ≥ 0"),
});

/**
 * AudioClip – Optimized for long audio (10+ minutes)
 *  - JIT scheduling with short lookahead window
 *  - Throttled UI clock updates
 *  - Smarter polling & limited fetch concurrency
 *  - Lazy WAV export (on click)
 */

export const AudioClip = ({ af }: AudioClipProps) => {
  // Advanced options toggle and forms
  const [showAdvanced, setShowAdvanced] = useState(false);
  const paddingAllForm = useForm<z.infer<typeof PaddingAllSchema>>({
    resolver: zodResolver(PaddingAllSchema),
    defaultValues: { paddingStartMs: 0, paddingEndMs: 0 },
  });
  const paddingForm = useForm<z.infer<typeof PaddingSchema>>({
    resolver: zodResolver(PaddingSchema),
    defaultValues: { paddingStartMs: 0, paddingEndMs: 0 },
  });

  // ──────────────────────────
  //  Audio graph & timeline
  // ──────────────────────────
  const audioRef = useRef<AudioContext | null>(null);
  const activeNodesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const nextStartRef = useRef<number>(0);

  // Scheduler (JIT) refs
  const LOOKAHEAD_S = 3; // seconds to keep scheduled ahead
  const SCHED_INTERVAL_MS = 50; // scheduler tick cadence
  const schedulerTimerRef = useRef<number | null>(null);
  const scheduleIdxRef = useRef(0); // index into timeline
  const scheduleLocalRef = useRef(0); // seconds into current segment

  // Bookkeeping
  const isPlayingRef = useRef(false);
  const startRef = useRef<number>(0); // ctx.currentTime when we hit Play
  const pausedOffset = useRef<number>(0); // where in the timeline we are when paused

  // Decoded buffers by sequence
  const buffersRef = useRef<Map<number, AudioBuffer>>(new Map());

  // Computed, padded timeline
  const timelineRef = useRef<
    {
      sequence: number;
      buffer: AudioBuffer;
      start: number; // inclusive
      end: number; // exclusive
      padStartSec: number;
      padEndSec: number;
    }[]
  >([]);

  // UI state
  const [bufferedDuration, setBufferedDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  // Used to force re-evaluation of allChunksLoaded when af.id changes
  const [audioFileVersion, setAudioFileVersion] = useState(0);

  // Scrubbing state: pause while dragging to avoid jumping
  const isScrubbingRef = useRef(false);
  const wasPlayingBeforeScrubRef = useRef(false);
  const handleScrubStart = () => {
    if (isScrubbingRef.current) return;
    isScrubbingRef.current = true;
    wasPlayingBeforeScrubRef.current = isPlayingRef.current;
    if (isPlayingRef.current) handlePause();
  };
  const handleScrubEnd = async (value?: number) => {
    if (!isScrubbingRef.current) return;
    isScrubbingRef.current = false;
    if (typeof value === "number") {
      seekTo(value);
    }
    if (wasPlayingBeforeScrubRef.current) {
      await ensureAudioUnlocked(); // iOS: make sure context is running before rescheduling
      scheduleFrom(pausedOffset.current);
      startRef.current = audioRef.current!.currentTime;
      setIsPlaying(true);
    }
  };
  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  // Reset all state and refs when af.id changes (new audio file selected)
  useEffect(() => {
    // Pause and stop all audio
    setIsPlaying(false);
    isPlayingRef.current = false;
    // Reset UI state
    setCurrentTime(0);
    setBufferedDuration(0);
    // Reset refs
    pausedOffset.current = 0;
    startRef.current = 0;
    scheduleIdxRef.current = 0;
    scheduleLocalRef.current = 0;
    nextStartRef.current = 0;
    // Clear buffers and timeline
    buffersRef.current.clear();
    timelineRef.current = [];
    // Stop any active nodes and scheduler
    if (audioRef.current) {
      try {
        // Stop all active nodes
        const nodes = Array.from(activeNodesRef.current);
        activeNodesRef.current.clear();
        for (const n of nodes) {
          try {
            n.stop();
          } catch {}
          try {
            n.disconnect();
          } catch {}
        }
      } catch {}
    }
    if (schedulerTimerRef.current != null) {
      clearInterval(schedulerTimerRef.current);
      schedulerTimerRef.current = null;
    }
    // Force re-evaluation of allChunksLoaded when af.id changes
    setAudioFileVersion((v) => v + 1);
  }, [af.id]);

  // ───────────────
  //  Fetch metadata (chunk list)
  // ───────────────
  const audioFileQuery = api.audio.chunks.fetchAll.useQuery(
    { audioFileId: af.id },
    {
      // Poll until all chunks are PROCESSED, then stop polling
      refetchInterval: (data) => {
        const chunks = data.state.data?.audioFile?.AudioChunks ?? [];
        const allDone =
          chunks.length > 0 &&
          chunks.every((c: any) => c.status === "PROCESSED");
        return allDone ? false : 2000;
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

  // ───────────────
  //  Fetch binaries with limited concurrency
  // ───────────────
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
          } catch (err) {
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

  // ───────────────
  //  Init / teardown AudioContext
  // ───────────────
  useEffect(() => {
    const ctx = new (window.AudioContext ||
      (window as any).webkitAudioContext)();
    audioRef.current = ctx;
    nextStartRef.current = ctx.currentTime;
    return () => {
      stopActiveNodes();
      stopScheduler();
      ctx.close();
      audioRef.current = null;
      buffersRef.current.clear();
      timelineRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─────────────────────────────
  //  iOS Safari: unlock/resume on gesture + 1-frame silent tick
  // ─────────────────────────────
  const unlockedRef = useRef(false);
  async function ensureAudioUnlocked() {
    let ctx = audioRef.current;
    if (!ctx || ctx.state === "closed") {
      ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioRef.current = ctx;
    }

    if (ctx.state !== "running") {
      try {
        await ctx.resume();
      } catch {}
      if (!unlockedRef.current) {
        try {
          const b = ctx.createBuffer(1, 1, ctx.sampleRate);
          const s = ctx.createBufferSource();
          s.buffer = b;
          s.connect(ctx.destination);
          // schedule a hair into the future to avoid "past" start
          s.start(ctx.currentTime + 0.01);
          s.onended = () => {
            try {
              s.disconnect();
            } catch {}
          };
        } catch {}
        unlockedRef.current = true;
      }
    }
  }

  // ─────────────────────────────
  //  Decode newly fetched WAVs
  // ─────────────────────────────
  useEffect(() => {
    (async () => {
      if (!audioRef.current || !wavFilesQuery.data?.length) return;
      const ctx = audioRef.current;

      let didChange = false;
      for (const { arrayBuffer, chunk } of wavFilesQuery.data) {
        if (buffersRef.current.has(chunk.sequence)) continue; // already decoded
        let decoded: AudioBuffer | null = null;
        try {
          // clone ArrayBuffer before decode
          decoded = await ctx.decodeAudioData(arrayBuffer.slice(0));
        } catch {
          continue;
        }
        if (decoded) {
          buffersRef.current.set(chunk.sequence, decoded);
          didChange = true;
        }
      }
      if (didChange) rebuildTimeline();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wavFilesQuery.data]);

  // ─────────────────────────────
  //  Rebuild timeline from buffers + metadata
  // ─────────────────────────────
  const rebuildTimeline = () => {
    const sorted = chunks;
    const tl: {
      sequence: number;
      buffer: AudioBuffer;
      start: number;
      end: number;
      padStartSec: number;
      padEndSec: number;
    }[] = [];

    let cursor = 0;
    for (const ch of sorted) {
      const buf = buffersRef.current.get(ch.sequence);
      if (!buf) continue; // skip not-yet-decoded
      const padStartSec = (ch.paddingStartMs ?? 0) / 1000;
      const padEndSec = (ch.paddingEndMs ?? 0) / 1000;
      const start = cursor;
      const end = start + padStartSec + buf.duration + padEndSec;
      tl.push({
        sequence: ch.sequence,
        buffer: buf,
        start,
        end,
        padStartSec,
        padEndSec,
      });
      cursor = end;
    }

    timelineRef.current = tl;
    setBufferedDuration(cursor);

    // If playing, re-schedule from the current visible time so changes apply immediately
    if (isPlayingRef.current) {
      scheduleFrom(currentTime);
      startRef.current = audioRef.current!.currentTime;
    }
  };

  // Rebuild timeline when padding metadata changes
  useEffect(() => {
    if (!buffersRef.current.size) return; // nothing decoded yet
    rebuildTimeline();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    chunks.length,
    chunks
      .map((c) => `${c.sequence}:${c.paddingStartMs}:${c.paddingEndMs}`)
      .join("|"),
  ]);

  // ─────────────────────────────
  //  JIT Scheduling (lookahead window)
  // ─────────────────────────────
  const stopActiveNodes = () => {
    const nodes = Array.from(activeNodesRef.current);
    activeNodesRef.current.clear();
    for (const n of nodes) {
      try {
        n.stop();
      } catch {}
      try {
        n.disconnect();
      } catch {}
    }
  };

  const stopScheduler = () => {
    if (schedulerTimerRef.current != null) {
      clearInterval(schedulerTimerRef.current);
      schedulerTimerRef.current = null;
    }
  };

  const mkNode = (ctx: AudioContext, buffer: AudioBuffer) => {
    const s = ctx.createBufferSource();
    s.buffer = buffer;
    s.connect(ctx.destination);
    activeNodesRef.current.add(s);
    s.onended = () => {
      try {
        s.disconnect();
      } catch {}
      activeNodesRef.current.delete(s);
    };
    return s;
  };

  // Move the scheduling pointers to an absolute timeline second
  const seekPointer = (offsetSec: number) => {
    const tl = timelineRef.current;
    let i = tl.findIndex((c) => offsetSec < c.end);
    if (i < 0) i = tl.length;
    scheduleIdxRef.current = i;
    scheduleLocalRef.current =
      i >= tl.length ? 0 : Math.max(0, offsetSec - tl[i]!.start);
  };

  const tickSchedule = () => {
    const ctx = audioRef.current!;
    const tl = timelineRef.current;
    if (!tl.length) return;

    let i = scheduleIdxRef.current;
    let local = scheduleLocalRef.current;
    let when = nextStartRef.current || ctx.currentTime;
    const horizon = ctx.currentTime + LOOKAHEAD_S;

    while (when < horizon && i < tl.length) {
      const seg = tl[i]!;
      const total = seg.padStartSec + seg.buffer.duration + seg.padEndSec;

      if (local < seg.padStartSec) {
        const wait = seg.padStartSec - local; // leading silence
        when += wait;
        local += wait;
      } else if (local < seg.padStartSec + seg.buffer.duration) {
        const offsetInBuf = local - seg.padStartSec; // inside audio
        const src = mkNode(ctx, seg.buffer);
        // clamp "when" into the future to avoid past-start on iOS after resume
        when = Math.max(when, ctx.currentTime + 0.01);
        src.start(when, offsetInBuf);
        const playDur = seg.buffer.duration - offsetInBuf;
        when += playDur;
        local += playDur;
      } else if (local < total) {
        const wait = total - local; // trailing silence
        when += wait;
        local += wait;
      }

      if (local >= total - 1e-6) {
        i += 1;
        local = 0;
      }
    }

    scheduleIdxRef.current = i;
    scheduleLocalRef.current = local;
    nextStartRef.current = when;

    if (i >= tl.length) stopScheduler();
  };

  const startScheduler = (fromSec: number) => {
    const ctx = audioRef.current!;
    stopActiveNodes();
    stopScheduler();

    seekPointer(fromSec);

    // guard: schedule slightly into the future (iOS resume has currentTime stalls)
    const EPS = 0.02;
    nextStartRef.current = Math.max(
      ctx.currentTime + EPS,
      nextStartRef.current || 0
    );

    // Fill initial window immediately, then keep topping up
    tickSchedule();
    schedulerTimerRef.current = window.setInterval(
      tickSchedule,
      SCHED_INTERVAL_MS
    );
  };

  // Replacement for old scheduleFrom
  const scheduleFrom = (offsetSec: number) => {
    if (!audioRef.current) return;
    startScheduler(offsetSec);
  };

  const handlePlay = async () => {
    await ensureAudioUnlocked();
    const ctx = audioRef.current!;
    startRef.current = ctx.currentTime;
    setIsPlaying(true);
    scheduleFrom(pausedOffset.current);
  };

  const handlePause = () => {
    if (!audioRef.current) return;
    const elapsed =
      audioRef.current.currentTime - startRef.current + pausedOffset.current;
    pausedOffset.current = Math.min(elapsed, bufferedDuration);
    setCurrentTime(pausedOffset.current);
    setIsPlaying(false);
    stopActiveNodes();
    stopScheduler();
  };

  const seekTo = (v: number) => {
    const clamped = Math.max(0, Math.min(v, bufferedDuration));
    pausedOffset.current = clamped;
    setCurrentTime(clamped);
    if (isPlayingRef.current) {
      scheduleFrom(clamped);
      startRef.current = audioRef.current!.currentTime;
    }
  };

  // ─────────────────────────────
  //  Progress clock / slider tick (throttled ~10fps)
  // ─────────────────────────────
  useEffect(() => {
    let raf = 0;
    let last = 0;
    const TICK_MS = 100; // 10 fps

    const tick = (t: number) => {
      if (isPlaying && audioRef.current) {
        const elapsed =
          audioRef.current.currentTime -
          startRef.current +
          pausedOffset.current;

        if (t - last >= TICK_MS) {
          if (elapsed < bufferedDuration) {
            setCurrentTime(elapsed);
          } else {
            setCurrentTime(bufferedDuration);
            setIsPlaying(false);
          }
          last = t;
        }
        raf = requestAnimationFrame(tick);
      }
    };

    if (isPlaying) raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isPlaying, bufferedDuration]);

  const formatTime = (sec: number) =>
    `${Math.floor(sec / 60)
      .toString()
      .padStart(2, "0")}:${Math.floor(sec % 60)
      .toString()
      .padStart(2, "0")}`;

  // Active sequence for highlight & seek-by-segment
  const activeSequence = useMemo(() => {
    const tl = timelineRef.current;
    if (!tl.length) return null;
    for (let i = 0; i < tl.length; i++) {
      const seg = tl[i]!;
      if (currentTime >= seg.start && currentTime < seg.end)
        return seg.sequence;
    }
    return null;
  }, [currentTime, bufferedDuration]);

  const seekToSequence = (sequence: number) => {
    const seg = timelineRef.current.find((s) => s.sequence === sequence);
    if (!seg) return; // not buffered yet
    seekTo(seg.start);
  };

  // Manual append test control (retained)
  const audioChunkSeqRef = useRef<number>(0);

  // Transcript text
  const transcript = useMemo(
    () => chunks.map((c: any) => c.text).join("") ?? "",
    [chunks]
  );

  // Keep padding form synced to selected chunk
  const selectedChunk = useMemo(
    () => chunks.find((c) => c.sequence === (activeSequence ?? -1)),
    [chunks, activeSequence]
  );

  useEffect(() => {
    paddingForm.reset({
      paddingStartMs: selectedChunk?.paddingStartMs ?? 0,
      paddingEndMs: selectedChunk?.paddingEndMs ?? 0,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    selectedChunk?.id,
    selectedChunk?.paddingStartMs,
    selectedChunk?.paddingEndMs,
  ]);

  const setPaddingMutation = api.audio.chunks.setPadding.useMutation();
  const setPaddingForAllMutation =
    api.audio.chunks.setPaddingForAll.useMutation();

  const onSubmitPadding = async (values: z.infer<typeof PaddingSchema>) => {
    if (!selectedChunk) return;
    const wasPlaying = isPlayingRef.current;
    if (wasPlaying) handlePause();

    await setPaddingMutation.mutateAsync({
      audioChunkId: selectedChunk.id,
      paddingStartMs: Math.max(0, Math.round(values.paddingStartMs)),
      paddingEndMs: Math.max(0, Math.round(values.paddingEndMs)),
    });

    await audioFileQuery.refetch();
    rebuildTimeline();

    if (wasPlaying) {
      setIsPlaying(true);
      scheduleFrom(currentTime);
      startRef.current = audioRef.current!.currentTime;
    }
  };

  const onSubmitPaddingAll = async (
    values: z.infer<typeof PaddingAllSchema>
  ) => {
    const wasPlaying = isPlayingRef.current;
    if (wasPlaying) handlePause();

    await setPaddingForAllMutation.mutateAsync({
      audioFileId: af.id,
      paddingStartMs: Math.max(0, Math.round(values.paddingStartMs)),
      paddingEndMs: Math.max(0, Math.round(values.paddingEndMs)),
    });

    await audioFileQuery.refetch();
    rebuildTimeline();

    if (wasPlaying) {
      setIsPlaying(true);
      scheduleFrom(currentTime);
      startRef.current = audioRef.current!.currentTime;
    }
  };

  const allChunksLoaded = (() => {
    // Add audioFileVersion to dependencies to force re-evaluation on af.id change
    return (
      Array.isArray(chunks) &&
      chunks.length > 0 &&
      chunks.every((c: any) => buffersRef.current.has(c.sequence)) &&
      chunks.every((c: any) => c.status === "PROCESSED")
    );
  })();

  // ───────────────
  //  Lazy WAV export (on click)
  // ───────────────
  const [isBuildingWav, setIsBuildingWav] = useState(false);

  function encodeWAV(buffers: AudioBuffer[]): Blob {
    if (!buffers.length) throw new Error("No buffers");
    const first = buffers[0]!;
    const numChannels = first.numberOfChannels;
    const sampleRate = first.sampleRate;

    // total length in frames
    let totalLength = 0;
    for (const buf of buffers) totalLength += buf.length;

    // interleave all buffers
    const result = new Float32Array(totalLength * numChannels);
    let offset = 0;
    for (const buf of buffers) {
      for (let ch = 0; ch < numChannels; ch++) {
        const data = buf.getChannelData(ch);
        for (let i = 0; i < buf.length; i++) {
          const idx = (offset + i) * numChannels + ch;
          result[idx] = data[i] ?? 0;
        }
      }
      offset += buf.length;
    }

    // Convert to 16-bit PCM
    const pcm = new DataView(new ArrayBuffer(44 + result.length * 2));
    function writeString(view: DataView, off: number, str: string) {
      for (let i = 0; i < str.length; i++)
        view.setUint8(off + i, str.charCodeAt(i));
    }
    writeString(pcm, 0, "RIFF");
    pcm.setUint32(4, 36 + result.length * 2, true);
    writeString(pcm, 8, "WAVE");
    writeString(pcm, 12, "fmt ");
    pcm.setUint32(16, 16, true); // PCM chunk size
    pcm.setUint16(20, 1, true); // PCM format
    pcm.setUint16(22, numChannels, true);
    pcm.setUint32(24, sampleRate, true);
    pcm.setUint32(28, sampleRate * numChannels * 2, true);
    pcm.setUint16(32, numChannels * 2, true);
    pcm.setUint16(34, 16, true); // bits per sample
    writeString(pcm, 36, "data");
    pcm.setUint32(40, result.length * 2, true);

    let idx = 44;
    for (let i = 0; i < result.length; i++, idx += 2) {
      const val = result[i] ?? 0;
      const s = Math.max(-1, Math.min(1, val));
      pcm.setInt16(idx, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }
    return new Blob([pcm.buffer], { type: "audio/wav" });
  }

  const handleDownload = async () => {
    if (!allChunksLoaded) return;
    setIsBuildingWav(true);
    try {
      const ordered = Array.isArray(chunks)
        ? chunks
            .map((c: any) => buffersRef.current.get(c.sequence))
            .filter((b): b is AudioBuffer => !!b)
        : [];

      const wavBlob = await new Promise<Blob>((resolve) => {
        // yield to keep UI responsive; for very long audio consider a Web Worker
        setTimeout(() => resolve(encodeWAV(ordered)), 0);
      });

      const url = URL.createObjectURL(wavBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `audio-${af.id}.wav`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setIsBuildingWav(false);
    }
  };

  const retryMutation = api.audio.inworld.retry.useMutation();
  const { data: userData } = authClient.useSession();

  // ───────────────
  //  JSX
  // ───────────────
  return (
    <div className="sm:border rounded-lg sm:p-4">
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="flex items-center gap-3">
          <Button
            onPointerDown={ensureAudioUnlocked} // iOS: unlock on real gesture
            onClick={isPlaying ? handlePause : handlePlay}
            disabled={!allChunksLoaded}
          >
            {isPlaying ? (
              <PauseIcon className="h-4 w-4" />
            ) : (
              <PlayIcon className="h-4 w-4" />
            )}
          </Button>
          <span className="tabular-nums">
            {formatTime(currentTime)} / {formatTime(bufferedDuration)}
          </span>
        </div>

        <div className="flex justify-between gap-2 items-center">
          {/* cost calculation */}
          {chunks.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {(() => {
                // Sum all characters in all chunks
                const totalChars = chunks.reduce(
                  (sum, c) => sum + (c.text?.length || 0),
                  0
                );
                const cost = ((totalChars * 10) / 1000000).toFixed(4);
                return `${totalChars} characters - $${cost}`;
              })()}
            </span>
          )}

          <div className="hidden sm:flex gap-2 items-center">
            <CopyButton info={"Click to copy transcript"} text={transcript} />

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  disabled={!allChunksLoaded || isBuildingWav}
                  variant="outline"
                  onClick={handleDownload}
                >
                  {isBuildingWav ? (
                    "Building…"
                  ) : (
                    <DownloadIcon className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Download WAV file</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>

      <Slider
        value={[currentTime]}
        min={0}
        max={Math.max(0.01, bufferedDuration)}
        step={0.01}
        onPointerDown={handleScrubStart}
        onValueChange={([v]) => {
          if (v == null) return;
          if (!isScrubbingRef.current) handleScrubStart();
          setCurrentTime(Math.max(0, Math.min(v, bufferedDuration)));
        }}
        onValueCommit={([v]) => {
          if (v == null) return;
          handleScrubEnd(v);
        }}
        className="w-full mb-2 h-10"
      />

      <div className="py-4 flex w-full gap-px">
        {chunks.map((chunk: any) => {
          const seg = timelineRef.current.find(
            (s) => s.sequence === chunk.sequence
          );
          const isActive =
            activeSequence != null && chunk.sequence === activeSequence;
          const canSeek = !!seg;
          return (
            <div
              key={chunk.id}
              title={`seq ${chunk.sequence} – ${chunk.status}`}
              onClick={() => {
                audioChunkSeqRef.current = chunk.sequence;
                if (canSeek) seekToSequence(chunk.sequence);
              }}
              aria-current={isActive ? "true" : undefined}
              className={cn(
                "relative first:rounded-l-md last:rounded-r-md h-4 flex-1 cursor-pointer transition-shadow",
                chunk.status === "PROCESSING" &&
                  "bg-yellow-500 hover:bg-yellow-500/90",
                chunk.status === "PROCESSED" &&
                  "bg-green-500 hover:bg-green-500/90",
                chunk.status === "ERROR" && "bg-red-500 hover:bg-red-500/90",
                chunk.status === "PENDING" &&
                  "bg-gray-500 hover:bg-gray-500/90",
                isActive && "outline outline-blue-500 animate-pulse"
              )}
            >
              {isActive && seg && (
                <div
                  className="absolute inset-y-0 left-0 bg-white/30 pointer-events-none"
                  style={{
                    width: `${
                      (Math.min(
                        Math.max(currentTime - seg.start, 0),
                        seg.end - seg.start
                      ) /
                        (seg.end - seg.start)) *
                      100
                    }%`,
                  }}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Show current chunk text */}
      <div className="flex flex-col w-full">
        <span className="text-sm text-muted-foreground min-h-[125px]">
          {chunks.find((c) => c.sequence === activeSequence)?.text}
        </span>
      </div>

      {/* Padding form */}
      <div>
        {setPaddingMutation.error && (
          <p className="text-xs text-red-500 mt-2">
            {(setPaddingMutation.error as any).message}
          </p>
        )}

        {/* Advanced options */}
        <div className="mt-6">
          <button
            type="button"
            className="text-xs underline text-blue-600 hover:text-blue-800 mb-2"
            onClick={() => setShowAdvanced((v) => !v)}
          >
            {showAdvanced ? "Hide advanced options" : "Show advanced options"}
          </button>
          {showAdvanced && (
            <div className="border rounded p-4 bg-gray-50 mt-2 space-y-4">
              <h4 className="text-base font-semibold mb-2">
                Update Padding (ms)
              </h4>
              <Form {...paddingForm}>
                <form
                  onSubmit={paddingForm.handleSubmit(onSubmitPadding)}
                  className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end"
                >
                  <FormField
                    control={paddingForm.control}
                    name="paddingStartMs"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Start padding</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={0}
                            step={10}
                            placeholder="0"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={paddingForm.control}
                    name="paddingEndMs"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>End padding</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={0}
                            step={10}
                            placeholder="0"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button
                    type="submit"
                    variant="outline"
                    disabled={
                      !selectedChunk ||
                      setPaddingMutation.isPending ||
                      !paddingForm.formState.isValid
                    }
                  >
                    {setPaddingMutation.isPending
                      ? "Updating…"
                      : "Apply to Selected Chunk"}
                  </Button>
                </form>
              </Form>

              <h4 className="font-semibold mb-2 text-sm">
                Set Padding for All Chunks
              </h4>
              <Form {...paddingAllForm}>
                <form
                  onSubmit={paddingAllForm.handleSubmit(onSubmitPaddingAll)}
                  className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end"
                >
                  <FormField
                    control={paddingAllForm.control}
                    name="paddingStartMs"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Start padding</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={0}
                            step={10}
                            placeholder="0"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={paddingAllForm.control}
                    name="paddingEndMs"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>End padding</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={0}
                            step={10}
                            placeholder="0"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button
                    type="submit"
                    variant="outline"
                    disabled={
                      setPaddingForAllMutation.isPending ||
                      !paddingAllForm.formState.isValid
                    }
                  >
                    {setPaddingForAllMutation.isPending
                      ? "Updating all…"
                      : "Apply to All Chunks"}
                  </Button>
                </form>
              </Form>
              {setPaddingForAllMutation.error && (
                <p className="text-xs text-red-500 mt-2">
                  {(setPaddingForAllMutation.error as any).message}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-4 items-center">
        {(chunks.some((c) => c.status === "ERROR") ||
          userData?.user.role === "admin") && (
          <Button
            variant="outline"
            onClick={() => retryMutation.mutate({ audioFileId: af.id })}
          >
            Retry Failed Chunks
          </Button>
        )}
      </div>
    </div>
  );
};

export default AudioClip;
