// ──────────────────────────────────────────────────────────────────────────────
// File: components/AudioClip.tsx
// ──────────────────────────────────────────────────────────────────────────────

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
import AudioClipSmart from "./audio-smart-clip";

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
 *
 * Unified Play/Pause:
 *  - On mobile (small screens) we play a fully stitched WAV via <audio> for stability.
 *  - On larger screens we play via JIT chunk scheduler (AudioContext) for scalability.
 *
 * The single Play/Pause button seamlessly switches between stitched vs. chunked modes,
 * and scrubbing works consistently for both.
 */

// Playability clamps to avoid landing *after* the end and to keep some frames to schedule
const END_EPSILON = 1e-3;
const clampPlayable = (offset: number, duration: number) =>
  Math.min(Math.max(0, offset), Math.max(0, duration - END_EPSILON));

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
  //  Responsive: mobile vs desktop
  // ──────────────────────────
  const [isSmallScreen, setIsSmallScreen] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)"); // Tailwind 'sm' breakpoint
    const apply = () => setIsSmallScreen(!!mq.matches);
    apply();
    mq.addEventListener?.("change", apply);
    return () => mq.removeEventListener?.("change", apply);
  }, []);

  // ──────────────────────────
  //  Audio graph & timeline (chunk scheduler path)
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

  // Decoded buffers by sequence (shared by both modes)
  const buffersRef = useRef<Map<number, AudioBuffer>>(new Map());

  // Computed, padded timeline (shared by both modes)
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

  // UI state (unified)
  const [bufferedDuration, setBufferedDuration] = useState(0); // scheduler timeline duration
  const [currentTime, setCurrentTime] = useState(0); // unified current time (stitched or scheduler)
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioFileVersion, setAudioFileVersion] = useState(0);

  // Which playback path are we currently *using* (while playing)?
  // "stitched" uses <audio> element; "scheduler" uses WebAudio chunk scheduler.
  const playbackModeRef = useRef<"stitched" | "scheduler" | null>(null);

  // Scrubbing state (unified): pause while dragging to avoid jumping
  const isScrubbingRef = useRef(false);
  const wasPlayingBeforeScrubRef = useRef(false);
  const handleScrubStart = () => {
    if (isScrubbingRef.current) return;
    isScrubbingRef.current = true;
    wasPlayingBeforeScrubRef.current = isPlayingRef.current;

    if (playbackModeRef.current === "stitched") {
      try {
        audioElRef.current?.pause();
      } catch {}
      setIsPlaying(false);
    } else if (playbackModeRef.current === "scheduler") {
      handlePauseScheduler();
    }
  };
  const handleScrubEnd = async (value?: number) => {
    if (!isScrubbingRef.current) return;
    isScrubbingRef.current = false;
    if (typeof value === "number") {
      if (playbackModeRef.current === "stitched") {
        const el = audioElRef.current;
        const targetDuration = stitchedDisplayDuration();
        const t = clampPlayable(value, targetDuration);
        if (el) {
          try {
            el.currentTime = t;
          } catch {}
          pausedOffset.current = el.currentTime;
          setCurrentTime(el.currentTime);
        } else {
          pausedOffset.current = t;
          setCurrentTime(t);
        }
      } else {
        seekToScheduler(value);
      }
    }
    if (wasPlayingBeforeScrubRef.current) {
      await ensureAudioUnlocked(); // iOS: ensure running before resuming
      if (shouldUseStitched()) {
        await playStitchedFrom(pausedOffset.current);
      } else {
        playSchedulerFrom(pausedOffset.current);
      }
    }
    wasPlayingBeforeScrubRef.current = false;
  };
  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  // Reset all state and refs when af.id changes (new audio file selected)
  useEffect(() => {
    setIsPlaying(false);
    isPlayingRef.current = false;
    setCurrentTime(0);
    setBufferedDuration(0);
    pausedOffset.current = 0;
    startRef.current = 0;
    scheduleIdxRef.current = 0;
    scheduleLocalRef.current = 0;
    nextStartRef.current = 0;
    buffersRef.current.clear();
    timelineRef.current = [];
    playbackModeRef.current = null;

    if (audioRef.current) {
      try {
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

    // stitched cleanup
    cleanupStitched();

    setAudioFileVersion((v) => v + 1);
  }, [af.id]);

  // ───────────────
  //  Fetch metadata (chunk list)
  // ───────────────
  const audioFileQuery = api.audio.chunks.fetchAll.useQuery(
    { audioFileId: af.id },
    {
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

  // ───────────────
  //  Init / teardown AudioContext (scheduler path)
  // ───────────────
  useEffect(() => {
    const ctx = new (window.AudioContext ||
      (window as any).webkitAudioContext)();
    audioRef.current = ctx;
    nextStartRef.current = ctx.currentTime;
    const onState = () => {};
    ctx.addEventListener?.("statechange", onState);
    return () => {
      stopActiveNodes();
      stopScheduler();
      ctx.removeEventListener?.("statechange", onState);
      ctx.close();
      audioRef.current = null;
      buffersRef.current.clear();
      timelineRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─────────────────────────────
  //  iOS Safari: robust unlock
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
          s.start(Math.max(ctx.currentTime + 0.02, 0.02));
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

  // Capture first gesture
  useEffect(() => {
    const onceOpts: AddEventListenerOptions = {
      once: true,
      passive: true,
      capture: true,
    };
    const handler = () => {
      void ensureAudioUnlocked();
    };
    document.addEventListener("pointerdown", handler, onceOpts);
    document.addEventListener("touchend", handler, onceOpts);
    document.addEventListener("mousedown", handler, onceOpts);
    return () => {
      document.removeEventListener("pointerdown", handler, onceOpts as any);
      document.removeEventListener("touchend", handler, onceOpts as any);
      document.removeEventListener("mousedown", handler, onceOpts as any);
    };
  }, []);

  // Resume after foreground
  useEffect(() => {
    const onVisibility = () => {
      if (!document.hidden && isPlayingRef.current) void ensureAudioUnlocked();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  // Decode newly fetched WAVs
  useEffect(() => {
    (async () => {
      if (!audioRef.current || !wavFilesQuery.data?.length) return;
      const ctx = audioRef.current;
      let didChange = false;
      for (const { arrayBuffer, chunk } of wavFilesQuery.data) {
        if (buffersRef.current.has(chunk.sequence)) continue;
        try {
          const decoded = await ctx.decodeAudioData(arrayBuffer.slice(0));
          if (decoded) {
            buffersRef.current.set(chunk.sequence, decoded);
            didChange = true;
          }
        } catch {}
      }
      if (didChange) rebuildTimeline();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wavFilesQuery.data]);

  // Rebuild timeline from buffers + metadata
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
      if (!buf) continue;
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

    // If currently playing, re-schedule / re-sync
    if (isPlayingRef.current) {
      if (playbackModeRef.current === "scheduler") {
        scheduleFromScheduler(currentTime);
        startRef.current = audioRef.current!.currentTime;
      } else if (playbackModeRef.current === "stitched") {
        // Keep stitched el in sync with UI current time if timeline length changes
        const el = audioElRef.current;
        if (el) {
          try {
            if (!isScrubbingRef.current) {
              el.currentTime = Math.min(
                el.currentTime,
                stitchedDisplayDuration()
              );
            }
          } catch {}
        }
      }
    }
  };

  // Rebuild timeline when padding changes
  useEffect(() => {
    if (!buffersRef.current.size) return;
    rebuildTimeline();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    chunks.length,
    chunks
      .map((c) => `${c.sequence}:${c.paddingStartMs}:${c.paddingEndMs}`)
      .join("|"),
  ]);

  // ────────────────────────────────────────────────────────────────────────────
  //  CHUNK SCHEDULER IMPLEMENTATION
  // ────────────────────────────────────────────────────────────────────────────
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
        const wait = seg.padStartSec - local;
        when += wait;
        local += wait;
      } else if (local < seg.padStartSec + seg.buffer.duration) {
        const offsetInBuf = local - seg.padStartSec;
        const src = mkNode(ctx, seg.buffer);
        when = Math.max(when, ctx.currentTime + 0.02);
        try {
          src.start(when, offsetInBuf);
        } catch {}
        const playDur = seg.buffer.duration - offsetInBuf;
        when += playDur;
        local += playDur;
      } else if (local < total) {
        const wait = total - local;
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

    // Clamp to just before end so there’s something to schedule
    const clamped = clampPlayable(fromSec, bufferedDuration);

    seekPointer(clamped);

    // IMPORTANT: reset nextStartRef so we don’t reuse a stale future time
    const EPS = 0.03;
    nextStartRef.current = ctx.currentTime + EPS;

    tickSchedule();
    schedulerTimerRef.current = window.setInterval(
      tickSchedule,
      SCHED_INTERVAL_MS
    );
  };

  const scheduleFromScheduler = (offsetSec: number) => {
    if (!audioRef.current) return;
    startScheduler(offsetSec);
  };

  const handlePauseScheduler = () => {
    if (!audioRef.current) return;
    const elapsed =
      audioRef.current.currentTime - startRef.current + pausedOffset.current;
    pausedOffset.current = Math.min(elapsed, bufferedDuration);
    setCurrentTime(pausedOffset.current);
    setIsPlaying(false);
    stopActiveNodes();
    stopScheduler();
  };

  const seekToScheduler = (v: number) => {
    const target = clampPlayable(v, bufferedDuration);
    pausedOffset.current = target;
    setCurrentTime(target);

    if (isPlayingRef.current && playbackModeRef.current === "scheduler") {
      scheduleFromScheduler(target);
      startRef.current = audioRef.current!.currentTime;
    }
  };

  // Progress ticker (~10fps) for scheduler
  useEffect(() => {
    let raf = 0;
    let last = 0;
    const TICK_MS = 100;
    const tick = (t: number) => {
      if (
        isPlaying &&
        audioRef.current &&
        playbackModeRef.current === "scheduler"
      ) {
        const elapsed =
          audioRef.current.currentTime -
          startRef.current +
          pausedOffset.current;
        if (t - last >= TICK_MS) {
          if (elapsed < bufferedDuration) setCurrentTime(elapsed);
          else {
            setCurrentTime(bufferedDuration);
            setIsPlaying(false);
            playbackModeRef.current = null;
          }
          last = t;
        }
        raf = requestAnimationFrame(tick);
      }
    };
    if (isPlaying && playbackModeRef.current === "scheduler")
      raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, bufferedDuration]);

  // ────────────────────────────────────────────────────────────────────────────
  //  STITCHED <audio> IMPLEMENTATION (mobile path)
  // ────────────────────────────────────────────────────────────────────────────
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const stitchedUrlRef = useRef<string | null>(null);
  const [stitchedIsBuilding, setStitchedIsBuilding] = useState(false);
  const [stitchedDuration, setStitchedDuration] = useState(0);

  // expected total secs (sum of buffers) so we can show a duration early
  const expectedDuration = useMemo(() => {
    const ordered = (chunks ?? [])
      .slice()
      .sort((a: any, b: any) => a.sequence - b.sequence)
      .map((c: any) => buffersRef.current.get(c.sequence))
      .filter((b): b is AudioBuffer => !!b);
    return ordered.reduce((s, b) => s + b.duration, 0);
  }, [chunks]);

  function encodeWAV(buffers: AudioBuffer[]): Blob {
    if (!buffers.length) throw new Error("No buffers");
    const first = buffers[0]!;
    const numChannels = first.numberOfChannels;
    const sampleRate = first.sampleRate;
    let totalLength = 0;
    for (const buf of buffers) totalLength += buf.length;
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
    const pcm = new DataView(new ArrayBuffer(44 + result.length * 2));
    function writeString(view: DataView, off: number, str: string) {
      for (let i = 0; i < str.length; i++)
        view.setUint8(off + i, str.charCodeAt(i));
    }
    writeString(pcm, 0, "RIFF");
    pcm.setUint32(4, 36 + result.length * 2, true);
    writeString(pcm, 8, "WAVE");
    writeString(pcm, 12, "fmt ");
    pcm.setUint32(16, 16, true);
    pcm.setUint16(20, 1, true);
    pcm.setUint16(22, numChannels, true);
    pcm.setUint32(24, sampleRate, true);
    pcm.setUint32(28, sampleRate * numChannels * 2, true);
    pcm.setUint16(32, numChannels * 2, true);
    pcm.setUint16(34, 16, true);
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

  const cleanupStitched = () => {
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
    setStitchedDuration(0);
  };

  const allChunksProcessed =
    chunks.length > 0 && chunks.every((c: any) => c.status === "PROCESSED");

  const ensureStitchedUrl = async (): Promise<string | null> => {
    if (stitchedUrlRef.current) return stitchedUrlRef.current;
    if (!allChunksProcessed) return null;

    const ordered = (chunks ?? [])
      .slice()
      .sort((a: any, b: any) => a.sequence - b.sequence)
      .map((c: any) => buffersRef.current.get(c.sequence))
      .filter((b): b is AudioBuffer => !!b);
    if (ordered.length !== chunks.length) return null;

    setStitchedIsBuilding(true);
    try {
      const wavBlob = await new Promise<Blob>((resolve) =>
        setTimeout(() => resolve(encodeWAV(ordered)), 0)
      );
      const url = URL.createObjectURL(wavBlob);
      stitchedUrlRef.current = url;
      return url;
    } finally {
      setStitchedIsBuilding(false);
    }
  };

  const wiredRef = useRef(false);
  const wireAudioEl = (el: HTMLAudioElement) => {
    if (wiredRef.current) return;
    wiredRef.current = true;

    el.addEventListener("ended", () => {
      setIsPlaying(false);
      playbackModeRef.current = null;
    });

    el.addEventListener("timeupdate", () => {
      if (!isScrubbingRef.current) {
        setCurrentTime(el.currentTime || 0);
        pausedOffset.current = el.currentTime || 0;
      }
    });

    el.addEventListener("loadedmetadata", () => {
      setStitchedDuration(
        Number.isFinite(el.duration) ? el.duration : expectedDuration
      );
    });
  };

  const stitchedDisplayDuration = () =>
    stitchedDuration || expectedDuration || 0;

  // ────────────────────────────────────────────────────────────────────────────
  //  UNIFIED PLAY/PAUSE
  // ────────────────────────────────────────────────────────────────────────────

  const shouldUseStitched = () =>
    isSmallScreen && allChunksProcessed && buffersRef.current.size > 0;

  const playStitchedFrom = async (fromSec: number) => {
    // Pause scheduler if it was active
    if (playbackModeRef.current === "scheduler") handlePauseScheduler();

    await ensureAudioUnlocked();

    const url = await ensureStitchedUrl();
    if (!url) {
      // Fallback if something went wrong
      playSchedulerFrom(fromSec);
      return;
    }

    let el = audioElRef.current;
    if (!el) {
      el = new Audio(url);
      el.preload = "auto";
      audioElRef.current = el;
      wireAudioEl(el);
    } else if (el.src !== url) {
      el.src = url;
    }

    const startAt = clampPlayable(fromSec, stitchedDisplayDuration());
    try {
      el.currentTime = startAt;
    } catch {}
    pausedOffset.current = el.currentTime || startAt;
    setCurrentTime(pausedOffset.current);

    try {
      await el.play();
      setIsPlaying(true);
      playbackModeRef.current = "stitched";
      if (!Number.isFinite(el.duration)) setStitchedDuration(expectedDuration);
    } catch {
      // Autoplay blocked—remain paused
      setIsPlaying(false);
      playbackModeRef.current = null;
    }
  };

  const pauseStitched = () => {
    try {
      audioElRef.current?.pause();
    } catch {}
    setIsPlaying(false);
    // retain playbackModeRef so scrub-commit can auto-resume into stitched if desired
  };

  const playSchedulerFrom = (fromSec: number) => {
    if (playbackModeRef.current === "stitched") pauseStitched();

    const target = clampPlayable(fromSec, bufferedDuration);
    scheduleFromScheduler(target);

    startRef.current = audioRef.current!.currentTime;
    setIsPlaying(true);
    playbackModeRef.current = "scheduler";
  };

  const togglePlay = async () => {
    // Don't toggle while scrubbing
    if (isScrubbingRef.current) return;

    // If playing → pause whichever mode is active
    if (isPlaying) {
      if (playbackModeRef.current === "stitched") {
        pauseStitched();
      } else if (playbackModeRef.current === "scheduler") {
        handlePauseScheduler();
      } else {
        setIsPlaying(false);
      }
      return;
    }

    // If paused → choose path based on screen & readiness
    await ensureAudioUnlocked();
    if (shouldUseStitched()) {
      await playStitchedFrom(pausedOffset.current);
    } else {
      const startAt = clampPlayable(pausedOffset.current, bufferedDuration);
      playSchedulerFrom(startAt);
    }
  };

  // Cleanup stitched resources on unmount / when afId changes handled above
  useEffect(() => {
    return () => {
      cleanupStitched();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ────────────────────────────────────────────────────────────────────────────
  //  Derived UI values & helpers
  // ────────────────────────────────────────────────────────────────────────────

  const hasAnyBuffered = bufferedDuration > 0;

  const formatTime = (sec: number) =>
    `${Math.floor(sec / 60)
      .toString()
      .padStart(2, "0")}:${Math.floor(sec % 60)
      .toString()
      .padStart(2, "0")}`;

  const activeSequence = useMemo(() => {
    const tl = timelineRef.current;
    if (!tl.length) return null;
    const t = currentTime;
    for (let i = 0; i < tl.length; i++) {
      const seg = tl[i]!;
      if (t >= seg.start && t < seg.end) return seg.sequence;
    }
    return null;
  }, [currentTime, bufferedDuration]);

  const seekToSequence = (sequence: number) => {
    const seg = timelineRef.current.find((s) => s.sequence === sequence);
    if (!seg) return;

    const target = seg.start;
    pausedOffset.current = target;
    setCurrentTime(target);

    if (isPlayingRef.current) {
      if (shouldUseStitched()) {
        const el = audioElRef.current;
        const t = clampPlayable(target, stitchedDisplayDuration());
        if (el) {
          try {
            el.currentTime = t;
          } catch {}
        } else {
          // If no element yet, start it from the target
          void playStitchedFrom(t);
        }
      } else {
        playSchedulerFrom(target);
        startRef.current = audioRef.current!.currentTime;
      }
    }
  };

  const transcript = useMemo(
    () => chunks.map((c: any) => c.text).join("") ?? "",
    [chunks]
  );
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
    if (wasPlaying) {
      if (playbackModeRef.current === "stitched") pauseStitched();
      else handlePauseScheduler();
    }
    await setPaddingMutation.mutateAsync({
      audioChunkId: selectedChunk.id,
      paddingStartMs: Math.max(0, Math.round(values.paddingStartMs)),
      paddingEndMs: Math.max(0, Math.round(values.paddingEndMs)),
    });
    await audioFileQuery.refetch();
    rebuildTimeline();
    if (wasPlaying) {
      if (shouldUseStitched()) {
        await playStitchedFrom(currentTime);
      } else {
        playSchedulerFrom(currentTime);
        startRef.current = audioRef.current!.currentTime;
      }
    }
  };

  const onSubmitPaddingAll = async (
    values: z.infer<typeof PaddingAllSchema>
  ) => {
    const wasPlaying = isPlayingRef.current;
    if (wasPlaying) {
      if (playbackModeRef.current === "stitched") pauseStitched();
      else handlePauseScheduler();
    }
    await setPaddingForAllMutation.mutateAsync({
      audioFileId: af.id,
      paddingStartMs: Math.max(0, Math.round(values.paddingStartMs)),
      paddingEndMs: Math.max(0, Math.round(values.paddingEndMs)),
    });
    await audioFileQuery.refetch();
    rebuildTimeline();
    if (wasPlaying) {
      if (shouldUseStitched()) {
        await playStitchedFrom(currentTime);
      } else {
        playSchedulerFrom(currentTime);
        startRef.current = audioRef.current!.currentTime;
      }
    }
  };

  // ────────────────────────────────────────────────────────────────────────────
  //  Download (stitched WAV)
  // ────────────────────────────────────────────────────────────────────────────
  const [isBuildingWav, setIsBuildingWav] = useState(false);

  const handleDownload = async () => {
    const allChunksLoaded =
      Array.isArray(chunks) &&
      chunks.length > 0 &&
      chunks.every((c: any) => buffersRef.current.has(c.sequence)) &&
      chunks.every((c: any) => c.status === "PROCESSED");
    if (!allChunksLoaded) return;
    setIsBuildingWav(true);
    try {
      const ordered = Array.isArray(chunks)
        ? chunks
            .map((c: any) => buffersRef.current.get(c.sequence))
            .filter((b): b is AudioBuffer => !!b)
        : [];
      const wavBlob = await new Promise<Blob>((resolve) => {
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

  // ────────────────────────────────────────────────────────────────────────────
  //  Render
  // ────────────────────────────────────────────────────────────────────────────

  const displayDuration =
    playbackModeRef.current === "stitched" || shouldUseStitched()
      ? stitchedDisplayDuration()
      : bufferedDuration;

  const canPlay =
    (shouldUseStitched() &&
      allChunksProcessed &&
      buffersRef.current.size > 0) ||
    (!shouldUseStitched() && hasAnyBuffered);

  return (
    <div
      className="sm:border rounded-lg sm:p-4"
      onPointerDownCapture={() => void ensureAudioUnlocked()}
      onTouchStartCapture={() => void ensureAudioUnlocked()}
      onMouseDownCapture={() => void ensureAudioUnlocked()}
    >
      <AudioClipSmart af={af} />

      {/* Title */}
      <h3 className="text-lg font-semibold mb-4">{af.name}</h3>

      {/* Unified controls (one button and one slider for both modes) */}
      <div className="flex-row-reverse sm:flex-row flex items-center justify-between gap-3 mb-2">
        <div className="flex-row-reverse sm:flex-row flex items-center gap-3">
          <Button
            onPointerDown={() => void ensureAudioUnlocked()}
            onTouchStart={() => void ensureAudioUnlocked()}
            onClick={togglePlay}
            disabled={!canPlay || stitchedIsBuilding}
          >
            {stitchedIsBuilding ? (
              (() => {
                // Show loading percentage of audio files loaded
                const total = chunks.length;
                const loaded = wavFilesQuery.data?.length || 0;
                const percent =
                  total > 0 ? Math.round((loaded / total) * 100) : 0;
                return (
                  <span className="text-xs tabular-nums min-w-[2.5em] inline-block">
                    {percent}%
                  </span>
                );
              })()
            ) : isPlaying ? (
              <PauseIcon className="size-4" />
            ) : (
              <PlayIcon className="size-4" />
            )}
          </Button>
          <span className="tabular-nums">
            {formatTime(currentTime)} / {formatTime(displayDuration)}
          </span>
        </div>

        <div className="flex justify-between gap-2 items-center">
          {chunks.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {(() => {
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
                  disabled={isBuildingWav}
                  variant="outline"
                  onClick={handleDownload}
                >
                  {isBuildingWav ? (
                    "Building…"
                  ) : (
                    <DownloadIcon className="size-4" />
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
        max={Math.max(0.01, displayDuration)}
        step={0.01}
        onPointerDown={handleScrubStart}
        onValueChange={([v]) => {
          if (v == null) return;
          if (!isScrubbingRef.current) handleScrubStart();
          const clamped = clampPlayable(v, displayDuration);
          setCurrentTime(clamped);
          pausedOffset.current = clamped;
        }}
        onValueCommit={([v]) => {
          if (v == null) return;
          handleScrubEnd(v);
        }}
        className="w-full h-10"
      />

      {/* Chunk status bar */}
      <div className="py-4 flex w-full sm:gap-px">
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

      {/* Transcript snippet */}
      <div className="flex flex-col w-full">
        <span className="text-sm text-muted-foreground min-h-[200px] sm:min-h-[125px]">
          {chunks.find((c) => c.sequence === activeSequence)?.text}
        </span>
      </div>

      {/* Padding controls */}
      <div>
        {setPaddingMutation.error && (
          <p className="text-xs text-red-500 mt-2">
            {(setPaddingMutation.error as any).message}
          </p>
        )}

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

      {/* Retry failed chunks */}
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
