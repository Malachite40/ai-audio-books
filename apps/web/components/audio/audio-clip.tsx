// ──────────────────────────────────────────────────────────────────────────────
// File: components/AudioClip.tsx (Native HTML5 Audio; stitched-aware, same UI)
// ──────────────────────────────────────────────────────────────────────────────

"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";

import { api } from "@/trpc/react";
import { Button } from "@workspace/ui/components/button";
import { Slider } from "@workspace/ui/components/slider";
import { cn } from "@workspace/ui/lib/utils";

// Forms
import { zodResolver } from "@hookform/resolvers/zod";
import {
  DownloadIcon,
  PauseIcon,
  PlayIcon,
  RefreshCwIcon,
} from "lucide-react/icons";
import { useForm } from "react-hook-form";

import { authClient } from "@/lib/auth-client";
import { useAudioPlaybackStore } from "@/store/use-audio-playback-store";
import { AudioFile } from "@workspace/database";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip";
import { toast } from "sonner";
import CopyButton from "../copy-button";
import { AudioSettingsButton } from "./audio-settings";

export interface AudioClipProps {
  af: AudioFile;
}

// ──────────────────────────────────────────────────────────────────────────────
// Schemas (kept)
// ──────────────────────────────────────────────────────────────────────────────
const PaddingAllSchema = z.object({
  paddingStartMs: z.coerce.number().min(0, "Must be ≥ 0"),
  paddingEndMs: z.coerce.number().min(0, "Must be ≥ 0"),
});

const PaddingSchema = z.object({
  paddingStartMs: z.coerce.number().min(0, "Must be ≥ 0"),
  paddingEndMs: z.coerce.number().min(0, "Must be ≥ 0"),
});

// Playability clamp so we never land after the end
const END_EPSILON = 1e-3;
const clampPlayable = (offset: number, duration: number) =>
  Math.min(Math.max(0, offset), Math.max(0, duration - END_EPSILON));

/** Try HEAD(+Range) to see if a URL is ready & rangeable; return ETag if present */
async function probePlayable(url: string) {
  try {
    const resp = await fetch(url, {
      method: "HEAD",
      cache: "no-store",
      // Many servers (yours included) support HEAD with Range → 206
      headers: { Range: "bytes=0-0" },
    });
    if (![200, 206].includes(resp.status)) return null;
    const accept = resp.headers.get("accept-ranges") || "";
    if (!accept.toLowerCase().includes("bytes")) return null;
    const etag = resp.headers.get("etag") || undefined;
    const len = Number(resp.headers.get("content-length") || "0");
    const ctype = resp.headers.get("content-type") || undefined;
    return { etag, len, ctype, status: resp.status };
  } catch {
    return null;
  }
}

/** Small helper to add cache-buster param from ETag (or timestamp) */
function withBuster(url: string, etag?: string) {
  const u = new URL(url);
  u.searchParams.set(etag ? "e" : "t", etag ?? String(Date.now()));
  return u.toString();
}

export default function AudioClip({ af }: AudioClipProps) {
  // ──────────────────────────
  // State
  // ──────────────────────────
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const rafRef = useRef<number | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [loadingPercent, setLoadingPercent] = useState(0);

  /** Resolved stitched URL (with cache-buster) & prep state */
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);
  const [resolvedExt, setResolvedExt] = useState<"mp3" | "m4a">("mp3");

  /** Candidate final assets – try MP3, then M4A */
  const baseMp3 = `https://instantaudio.online/audio/${af.id}.mp3`;

  // Playback rate (Zustand)
  const playbackRate = useAudioPlaybackStore((s) => s.playbackRate);

  // ──────────────────────────
  // Persist & restore position
  // ──────────────────────────
  const upsertSettings = api.audio.settings.upsert.useMutation();
  const audioFetchQuery = api.audio.fetch.useQuery(
    { id: af.id },
    { staleTime: 10_000 }
  );

  const saveTimerRef = useRef<number | null>(null);
  const lastSentAtRef = useRef(0);
  const lastSavedTimeRef = useRef(-1);

  const flushSave = (force = false) => {
    const video = videoRef.current;
    if (!video) return;
    const t = Math.max(0, video.currentTime || 0);
    const rounded = Math.round(t * 1000) / 1000;
    if (!force && Math.abs(rounded - lastSavedTimeRef.current) < 0.25) return;
    try {
      upsertSettings.mutate({ id: af.id, currentTime: rounded });
      lastSavedTimeRef.current = rounded;
      lastSentAtRef.current = Date.now();
    } catch {}
    if (saveTimerRef.current != null) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
  };
  const scheduleSave = () => {
    const MIN_GAP_MS = 2000;
    const since = Date.now() - lastSentAtRef.current;
    if (saveTimerRef.current != null) clearTimeout(saveTimerRef.current);
    const wait = since >= MIN_GAP_MS ? 300 : MIN_GAP_MS - since;
    saveTimerRef.current = window.setTimeout(() => flushSave(), wait);
  };

  const desiredStartRef = useRef(0);
  const appliedInitialRef = useRef(false);

  // ──────────────────────────
  // Resolve the stitched asset URL (probe MP3→M4A, poll while preparing)
  // ──────────────────────────
  const audioStatus = audioFetchQuery.data?.audioFile?.status;

  useEffect(() => {
    let stop = false;
    let pollTimer: number | null = null;

    const attempt = async () => {
      if (stop) return;

      // Prefer MP3; if you output M4A, this falls through
      const tryOne = async (url: string, ext: "mp3" | "m4a") => {
        const res = await probePlayable(withBuster(url)); // temp buster to defeat 404 caching
        if (!res) return null;
        const final = withBuster(url, res.etag); // stable cache-buster from ETag if present
        return { url: final, ext };
      };

      const mp3 = await tryOne(baseMp3, "mp3");
      const chosen = mp3;
      if (chosen) {
        setResolvedUrl(chosen.url);
        setResolvedExt(chosen.ext);
        return;
      }

      // If chunks are still processing OR stitch job is likely still running, poll
      pollTimer = window.setTimeout(attempt, 1500);
    };

    // Fire immediately when file id or status changes
    setResolvedUrl(null);
    attempt();

    return () => {
      stop = true;
      if (pollTimer != null) clearTimeout(pollTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [af.id, baseMp3, audioStatus]);

  // ──────────────────────────
  // Video Event Handlers
  // ──────────────────────────
  const handleLoadedMetadata = () => {
    const video = videoRef.current;
    if (!video) return;

    const nativeDuration = video.duration || 0;

    setDuration(nativeDuration);
    setLoadingPercent(100);

    // Apply saved position if available
    const saved =
      audioFetchQuery.data?.audioFile?.AudioFileSettings?.[0]?.currentTime;
    if (
      !appliedInitialRef.current &&
      typeof saved === "number" &&
      isFinite(saved) &&
      saved > 0.05
    ) {
      desiredStartRef.current = saved;
      setCurrentTime(saved);
      video.currentTime = saved;
      appliedInitialRef.current = true;
    } else if (audioFetchQuery.isSuccess) {
      appliedInitialRef.current = true;
    }
  };

  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video) return;
    setCurrentTime(video.currentTime);
    scheduleSave();
  };

  const handlePlay = () => {
    setIsPlaying(true);
    const step = () => {
      if (!videoRef.current || videoRef.current.paused) return;
      setCurrentTime(videoRef.current.currentTime);
      scheduleSave();
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
  };

  const handlePause = () => {
    setIsPlaying(false);
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    flushSave(true);
  };

  const handleLoadStart = () => {
    setLoadingPercent(0);
  };

  const handleProgress = () => {
    const video = videoRef.current;
    if (!video) return;

    if (video.buffered.length > 0) {
      const bufferedEnd = video.buffered.end(video.buffered.length - 1);
      const duration = video.duration || 1;
      const percent = Math.round((bufferedEnd / duration) * 100);
      setLoadingPercent(percent);
    }
  };

  const handleError = () => {
    setIsPlaying(false);
    console.error("[AudioClip] Video loading error");
  };

  const handleCanPlay = () => {
    const video = videoRef.current;
    if (!video) return;

    const nativeDuration = video.duration || 0;

    // Update duration if it's different from what we have
    if (nativeDuration > 0 && Math.abs(nativeDuration - duration) > 0.1) {
      setDuration(nativeDuration);
    }
  };

  const handleLoadedData = () => {
    const video = videoRef.current;
    if (!video) return;

    const nativeDuration = video.duration || 0;

    // Update duration if it's different from what we have
    if (nativeDuration > 0 && Math.abs(nativeDuration - duration) > 0.1) {
      setDuration(nativeDuration);
    }
  };

  // ──────────────────────────
  // Setup video element when URL changes
  // ──────────────────────────
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !resolvedUrl) return;

    // Reset state
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setLoadingPercent(0);

    // Set video source and properties
    video.src = resolvedUrl;
    video.preload = "auto"; // Changed from "metadata" to "auto" to ensure full loading
    video.playbackRate = Math.max(0.25, Math.min(4, playbackRate));

    // Load the video
    video.load();

    return () => {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [resolvedUrl, playbackRate]);

  // Update playback rate when it changes
  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      video.playbackRate = Math.max(0.25, Math.min(4, playbackRate));
    }
  }, [playbackRate]);

  // Flush saves on unload
  useEffect(() => {
    const onHide = () => flushSave(true);
    window.addEventListener("pagehide", onHide);
    window.addEventListener("beforeunload", onHide);
    return () => {
      window.removeEventListener("pagehide", onHide);
      window.removeEventListener("beforeunload", onHide);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [af.id]);

  // ──────────────────────────
  // Play / Pause / Seek
  // ──────────────────────────
  const playFrom = (t: number) => {
    const video = videoRef.current;
    if (!video) return;

    try {
      const nativeDuration = video.duration || 0;
      const target = clampPlayable(t, nativeDuration);
      video.currentTime = target;
      video.play().catch(console.error);
    } catch (error) {
      console.error("[AudioClip] Play error:", error);
    }
  };

  const pause = () => {
    const video = videoRef.current;
    if (video) {
      video.pause();
    }
    setIsPlaying(false);
    flushSave(true);
  };

  const togglePlay = () => {
    if (!resolvedUrl) return;
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      const nativeDuration = video.duration || 0;
      const startT = clampPlayable(
        desiredStartRef.current || video.currentTime || currentTime || 0,
        nativeDuration
      );

      video.currentTime = startT;
      video.play().catch(console.error);
    } else {
      pause();
    }
  };

  // ──────────────────────────
  // Chunks & transcript (UI only, unchanged)
  // ──────────────────────────
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

  const transcript = useMemo(
    () => chunks.map((c: any) => c.text).join("") ?? "",
    [chunks]
  );

  // Build a timeline map of actual chunk positions with padding
  const chunkTimeline = useMemo(() => {
    if (!chunks.length) return [];

    let t = 0;
    return chunks.map((chunk: any) => {
      const startPad = Math.max(0, chunk.paddingStartMs ?? 0);
      const endPad = Math.max(0, chunk.paddingEndMs ?? 0);
      const bodyMs = Math.max(0, chunk.durationMs ?? 0);

      // Inclusive start: include the chunk’s start padding
      const startMs = t;
      const padStartMs = t;

      t += startPad;

      // First sample of the spoken content
      const contentStartMs = t;

      t += bodyMs;
      const contentEndMs = t;

      // Include the chunk’s end padding
      t += endPad;
      const endMs = t; // exclusive end

      return {
        chunk,
        startMs,
        endMs,
        startSec: startMs / 1000,
        endSec: endMs / 1000,
        contentStartSec: contentStartMs / 1000,
        contentEndSec: contentEndMs / 1000,
      };
    });
  }, [chunks]);

  const activeSequence = useMemo(() => {
    if (!chunkTimeline.length) return null as number | null;

    // Find which chunk contains the current playback time, including padding
    const currentSec = currentTime;
    // If at or before the very start, highlight the first chunk
    if (currentSec <= chunkTimeline[0]!.startSec) {
      return chunkTimeline[0]!.chunk.sequence;
    }
    // If at or after the very end, highlight the last chunk
    if (currentSec >= chunkTimeline[chunkTimeline.length - 1]!.endSec) {
      return chunkTimeline[chunkTimeline.length - 1]!.chunk.sequence;
    }
    // Otherwise, find the chunk whose timeline includes the current time
    const entry = chunkTimeline.find(
      (t) => currentSec >= t.startSec && currentSec < t.endSec
    );
    return entry?.chunk.sequence ?? null;
  }, [chunkTimeline, currentTime]);

  const selectedChunk = useMemo(
    () => chunks.find((c) => c.sequence === (activeSequence ?? -1)),
    [chunks, activeSequence]
  );

  const seekToSequence = (sequence: number) => {
    if (!chunkTimeline.length) return;
    const entry = chunkTimeline.find((t) => t.chunk.sequence === sequence);
    if (!entry) return;

    // Start of spoken content; falls back to padded start if needed
    const target = (entry as any).contentStartSec ?? entry.startSec;
    setCurrentTime(target);
    desiredStartRef.current = target;
    playFrom(target);
  };

  // Padding controls (kept)
  const setPaddingMutation = api.audio.chunks.setPadding.useMutation();
  const setPaddingForAllMutation =
    api.audio.chunks.setPaddingForAll.useMutation();

  const [showAdvanced, setShowAdvanced] = useState(false);
  const paddingAllForm = useForm<z.infer<typeof PaddingAllSchema>>({
    resolver: zodResolver(PaddingAllSchema),
    defaultValues: { paddingStartMs: 0, paddingEndMs: 0 },
  });
  const paddingForm = useForm<z.infer<typeof PaddingSchema>>({
    resolver: zodResolver(PaddingSchema),
    defaultValues: { paddingStartMs: 0, paddingEndMs: 0 },
  });

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

  const retryMutation = api.audio.inworld.retry.useMutation();
  const { data: userData } = authClient.useSession();

  // ──────────────────────────
  // Scrubbing
  // ──────────────────────────
  const isScrubbingRef = useRef(false);
  const wasPlayingBeforeScrubRef = useRef(false);
  const handleScrubStart = () => {
    if (isScrubbingRef.current) return;
    isScrubbingRef.current = true;
    wasPlayingBeforeScrubRef.current = isPlaying;
    if (isPlaying) pause();
  };
  const handleScrubEnd = (val?: number) => {
    if (!isScrubbingRef.current) return;
    isScrubbingRef.current = false;
    if (typeof val !== "number") return;
    const d = uiDuration;
    const t = clampPlayable(val, d || val);
    desiredStartRef.current = t;
    setCurrentTime(t);

    const video = videoRef.current;
    if (video) {
      video.currentTime = t;
    }

    if (wasPlayingBeforeScrubRef.current) {
      playFrom(t);
    }
    wasPlayingBeforeScrubRef.current = false;
  };

  // Helpers
  const formatTime = (sec: number) => {
    if (!Number.isFinite(sec)) return "00:00";
    const s = Math.floor(sec);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const ss = s % 60;
    return h > 0
      ? `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")}`
      : `${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
  };

  // Derived UI values & helpers - use native audio duration
  const uiDuration = duration || 0;
  const uiCurrentTime = uiDuration > 0 ? currentTime : 0;

  /** Treat "preparing" as loading state */
  const isLoadingToStart = !resolvedUrl && !isPlaying;

  // Show 'Stitching...' if all chunks are processed but no resolvedUrl
  const allChunksProcessed =
    chunks.length > 0 && chunks.every((c: any) => c.status === "PROCESSED");
  const isStitching = allChunksProcessed && !resolvedUrl;

  const totalChars = useMemo(
    () =>
      chunks.reduce((sum: number, c: any) => sum + (c.text?.length || 0), 0),
    [chunks]
  );

  const handleDownload = async () => {
    if (!resolvedUrl) {
      toast("Hold on!", {
        description:
          "The audio is still being prepared. Please try again shortly.",
      });
      return;
    }
    try {
      const res = await fetch(resolvedUrl);
      if (!res.ok) throw new Error("Network error");
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `${af.name || af.id}.mp3`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error("Download error:", error);
      toast("Failed to download audio");
    }
  };

  return (
    <div className="sm:border rounded-lg sm:p-4">
      {/* Hidden Video Element for Audio Playback */}
      {!isLoadingToStart && (
        <video
          ref={videoRef}
          onLoadedMetadata={handleLoadedMetadata}
          onLoadedData={handleLoadedData}
          onCanPlay={handleCanPlay}
          onTimeUpdate={handleTimeUpdate}
          onPlay={handlePlay}
          onPause={handlePause}
          onEnded={handleEnded}
          onLoadStart={handleLoadStart}
          onProgress={handleProgress}
          onError={handleError}
          preload="auto"
          className="hidden"
          muted={false}
        >
          {resolvedUrl && <source src={resolvedUrl} type="audio/mpeg" />}
        </video>
      )}

      {/* Title */}
      <h3 className="text-lg font-semibold mb-4">{af.name}</h3>

      {/* Unified controls (kept) */}
      <div className="flex-row-reverse sm:flex-row flex items-center justify-between gap-3 mb-2">
        <div className="flex-row-reverse sm:flex-row flex items-center gap-3">
          <Button
            className="rounded-full"
            onClick={togglePlay}
            aria-busy={isLoadingToStart ? true : undefined}
            disabled={isLoadingToStart}
            size={isLoadingToStart ? "sm" : "icon"}
          >
            {isPlaying ? (
              <PauseIcon className="size-4 text-background/70 fill-background/80" />
            ) : isLoadingToStart ? (
              <span className="inline-flex items-center gap-2">
                <span className="text-xs tabular-nums min-w-[5em] inline-block animate-pulse">
                  {`${loadingPercent}%`}
                </span>
              </span>
            ) : (
              <PlayIcon className="size-4 text-background/70 fill-background/80" />
            )}
          </Button>

          {/* Playback speed */}
          <div className="flex items-center gap-2">
            <AudioSettingsButton />
          </div>

          <span className="tabular-nums">
            {formatTime(uiCurrentTime)} / {formatTime(uiDuration)}
          </span>
        </div>

        <div className="flex justify-between gap-2 items-center">
          {chunks.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {(() => {
                const cost = ((totalChars * 10) / 1_000_000).toFixed(4);
                return `${totalChars} chars - $${cost}`;
              })()}
            </span>
          )}

          <div className="hidden sm:flex gap-2 items-center">
            <CopyButton info={"Click to copy transcript"} text={transcript} />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  onClick={handleDownload}
                  disabled={!resolvedUrl}
                >
                  <DownloadIcon className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Download {resolvedExt.toUpperCase()}</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>

      {/* Seek bar with optional Stitching overlay */}
      <div className="relative w-full">
        <Slider
          value={[uiCurrentTime]}
          min={0}
          max={Math.max(0.01, uiDuration)}
          step={0.01}
          onTouchStart={handleScrubStart}
          onMouseDown={handleScrubStart}
          onPointerDown={handleScrubStart}
          onValueChange={([v]) => {
            if (v == null) return;
            if (!isScrubbingRef.current) handleScrubStart();
            const clamped = clampPlayable(v, uiDuration || v);
            desiredStartRef.current = clamped;
            setCurrentTime(clamped);
          }}
          onValueCommit={([v]) => {
            if (v == null) return;
            handleScrubEnd(v);
          }}
          className="w-full h-10"
          disabled={!resolvedUrl}
        />
        {isStitching && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="px-4 py-1 rounded bg-background/80 text-primary font-semibold text-sm animate-pulse shadow-lg border border-primary">
              Stitching...
            </span>
          </div>
        )}
      </div>

      {/* Chunk status bar with accurate positioning */}
      <div className="py-4 flex w-full sm:gap-px">
        {(() => {
          // If any chunk is not PROCESSED, use equal width for all
          const allProcessed = chunks.every(
            (c: any) => c.status === "PROCESSED"
          );
          return chunkTimeline.map((entry, i) => {
            const chunk = entry.chunk;
            const isActive =
              activeSequence != null && chunk.sequence === activeSequence;

            // Calculate progress within this specific chunk
            let progress = 0;
            if (isActive && entry.endSec > entry.startSec) {
              // If in the padding before or after the chunk's main audio, show full progress
              if (currentTime < entry.startSec || currentTime >= entry.endSec) {
                progress = 100;
              } else {
                const chunkProgress = currentTime - entry.startSec;
                const chunkDuration = entry.endSec - entry.startSec;
                progress =
                  (Math.max(0, Math.min(chunkProgress, chunkDuration)) /
                    chunkDuration) *
                  100;
              }
            }

            // If not all processed, use equal width; else use proportional width
            let flexValue = 1;
            if (allProcessed) {
              const totalDurationMs =
                chunkTimeline[chunkTimeline.length - 1]?.endMs ?? 1;
              const chunkDurationMs = entry.endMs - entry.startMs;
              flexValue = Math.max(
                0.1,
                (chunkDurationMs / totalDurationMs) * chunks.length
              );
            }

            return (
              <div
                key={chunk.id}
                title={`seq ${chunk.sequence} – ${chunk.status} (${Math.round(entry.startSec)}s-${Math.round(entry.endSec)}s)`}
                onClick={() => seekToSequence(chunk.sequence)}
                aria-current={isActive ? "true" : undefined}
                style={{ flex: flexValue }}
                className={cn(
                  "relative first:rounded-l-md last:rounded-r-md h-4 cursor-pointer transition-shadow",
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
                {isActive && (
                  <div
                    className="absolute inset-y-0 left-0 bg-white/30 pointer-events-none"
                    style={{ width: `${progress}%` }}
                  />
                )}
              </div>
            );
          });
        })()}
      </div>

      {/* Transcript snippet (kept) */}
      <div className="flex flex-col w-full">
        <span className="text-sm text-muted-foreground min-h-[200px] sm:min-h-[125px]">
          {chunks.find((c) => c.sequence === activeSequence)?.text}
        </span>
      </div>

      {/* Retry failed chunks (kept) */}
      <div className="flex gap-4 items-center">
        {(chunks.some((c) => c.status === "ERROR") ||
          userData?.user.role === "admin") && (
          <Button
            className="md:flex-0 flex-1 gap-2 flex"
            variant="outline"
            onClick={() => retryMutation.mutate({ audioFileId: af.id })}
          >
            <RefreshCwIcon className="h-4 w-4" />
            <span>Retry Failed Chunks</span>
          </Button>
        )}
      </div>
    </div>
  );
}
