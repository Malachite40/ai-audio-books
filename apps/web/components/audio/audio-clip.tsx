// ──────────────────────────────────────────────────────────────────────────────
// File: components/AudioClip.tsx (Native HTML5 Audio; stitched-aware, same UI)
// ──────────────────────────────────────────────────────────────────────────────

"use client";
import { memo, useEffect, useMemo, useRef, useState } from "react";

import { api } from "@/trpc/react";
import { Button } from "@workspace/ui/components/button";
import { Slider } from "@workspace/ui/components/slider";
import { cn } from "@workspace/ui/lib/utils";

// Forms
import { DownloadIcon, PauseIcon, PlayIcon } from "lucide-react/icons";

import { LoadingScreen } from "@/app/(app)/audio-file/[id]/loading";
import { useAudioPlaybackStore } from "@/store/use-audio-playback-store";
import { AudioFile } from "@workspace/database";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip";
import { toast } from "sonner";
import CopyButton from "../copy-button";
import { FavoriteButton } from "./audio-favorites-button";
import { AudioSettingsButton } from "./audio-settings";
import { ShareButton } from "./audio-share-button";

export interface AudioClipProps {
  af: AudioFile;
}

// Playability clamp so we never land after the end
const END_EPSILON = 1e-3;
const clampPlayable = (offset: number, duration: number) =>
  Math.min(Math.max(0, offset), Math.max(0, duration - END_EPSILON));

const AudioClip = memo(function AudioClip({ af }: AudioClipProps) {
  // Fetch chunk status counts
  const chunkStatusCountsQuery = api.audio.chunkStatusCounts.useQuery(
    { audioFileId: af.id },
    {
      refetchInterval: (query) => {
        if (!query.state.data?.counts) return 3000;
        // Transform rawCounts array into { status: count }
        const rawCounts = query.state.data.counts;
        const chunkCounts: Record<string, number> = {};
        for (const row of rawCounts) {
          chunkCounts[row.status] = row._count.status;
        }
        const totalChunks = Object.values(chunkCounts).reduce(
          (a, b) => Number(a) + Number(b),
          0
        );
        const processedChunks = chunkCounts["PROCESSED"] ?? 0;

        const isAllProcessed =
          totalChunks > 0 && processedChunks === totalChunks;
        return isAllProcessed ? false : 5000;
      },
    }
  );

  // Progress bar logic (memoized)
  const {
    totalChunks,
    processedChunks,
    errorChunks,
    isAllProcessed,
    isError,
    progressPercent,
    chunkCounts,
  } = useMemo(() => {
    const rawCounts = chunkStatusCountsQuery.data?.counts ?? [];
    const chunkCounts: Record<string, number> = {};
    for (const row of rawCounts) {
      chunkCounts[row.status] = row._count.status;
    }
    const totalChunks = Object.values(chunkCounts).reduce(
      (a, b) => Number(a) + Number(b),
      0
    );
    const processedChunks = chunkCounts["PROCESSED"] ?? 0;
    const errorChunks = chunkCounts["ERROR"] ?? 0;
    const isAllProcessed = totalChunks > 0 && processedChunks === totalChunks;
    const isError = errorChunks > 0;
    const progressPercent =
      totalChunks > 0 ? Math.round((processedChunks / totalChunks) * 100) : 0;
    return {
      totalChunks,
      processedChunks,
      errorChunks,
      isAllProcessed,
      isError,
      progressPercent,
      chunkCounts,
    };
  }, [chunkStatusCountsQuery.data]);
  // ──────────────────────────
  // State
  // ──────────────────────────
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const rafRef = useRef<number | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [loadingPercent, setLoadingPercent] = useState(0);

  /** Candidate final assets – try MP3, then M4A */
  const baseMp3 = `https://instantaudio.online/audio/${af.id}.mp3`;

  // Playback rate (Zustand)
  const playbackRate = useAudioPlaybackStore((s) => s.playbackRate);

  // ──────────────────────────
  // Persist & restore position
  // ──────────────────────────
  const upsertSettings = api.audio.settings.upsert.useMutation();
  const audioFileQuery = api.audio.fetch.useQuery(
    { id: af.id },
    {
      refetchOnWindowFocus: false,
      refetchInterval(query) {
        const a = query.state.data?.audioFile;
        if (!a) return false;
        switch (a.status) {
          case "GENERATING_STORY":
          case "PENDING":
          case "PROCESSING":
            return 3000;
          case "ERROR":
          case "PROCESSED":
            if (a.imageUrl?.includes("/image-generating-placeholder.png"))
              return 10000;
            return false;
        }
      },
    }
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
      audioFileQuery.data?.audioFile?.AudioFileSettings?.[0]?.currentTime;
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
    } else if (audioFileQuery.isSuccess) {
      appliedInitialRef.current = true;
    }
  };

  const [showFullText, setShowFullText] = useState(false);

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

  const resolvedUrl = useMemo(() => {
    if (!audioFileQuery.data?.audioFile) return null;

    const { id, status } = audioFileQuery.data.audioFile;
    if (status === "PROCESSED")
      return "https://instantaudio.online" + `/audio/${id}.mp3`;
  }, [audioFileQuery.data]);

  // ──────────────────────────
  // Setup video element when URL changes
  // ──────────────────────────
  // Only reset state and reload video when the URL changes
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
  }, [resolvedUrl]);

  // Only update playback rate when it changes
  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      video.playbackRate = Math.max(0.25, Math.min(4, playbackRate));
    }
  }, [playbackRate]);

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
      // If at (or very near) the end, reset to 0
      if (
        nativeDuration > 0 &&
        Math.abs(video.currentTime - nativeDuration) < END_EPSILON * 2
      ) {
        video.currentTime = 0;
      } else {
        const startT = clampPlayable(
          desiredStartRef.current || video.currentTime || currentTime || 0,
          nativeDuration
        );
        video.currentTime = startT;
      }
      video.play().catch(console.error);
    } else {
      pause();
    }
  };

  // Format time helper (memoized)
  const formatTime = useMemo(() => {
    return (sec: number) => {
      if (!Number.isFinite(sec)) return "00:00";
      const s = Math.floor(sec);
      const h = Math.floor(s / 3600);
      const m = Math.floor((s % 3600) / 60);
      const ss = s % 60;
      return h > 0
        ? `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")}`
        : `${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
    };
  }, []);

  // Derived UI values & helpers - use native audio duration
  const uiDuration = duration || 0;
  const uiCurrentTime = uiDuration > 0 ? currentTime : 0;

  /** Treat "preparing" as loading state */
  const isLoadingToStart = !resolvedUrl && !isPlaying;

  // Stitching state is now derived from chunkStatusCounts
  const isStitching = isAllProcessed && !resolvedUrl;

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
      a.download = `${af.id}.mp3`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error("Download error:", error);
      toast("Failed to download audio");
    }
  };

  if (!audioFileQuery.data || !audioFileQuery.data.audioFile) {
    return (
      <LoadingScreen
        title="Loading Audio..."
        subtitle="Please wait while your audio is being prepared."
      />
    );
  }

  const audioFile = audioFileQuery.data.audioFile;

  if (audioFile.status === "GENERATING_STORY") {
    return (
      <LoadingScreen
        title="Generating Story..."
        subtitle="Please wait while your story is being generated."
      />
    );
  }

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

      {/* Image and Title narrator */}
      <div className="w-full flex justify-center items-center mb-6 flex-col gap-6">
        {/* Image */}
        {audioFile.imageUrl ? (
          <img
            src={audioFile.imageUrl}
            alt={audioFile.name}
            className="h-40 w-40 aspect-square object-cover rounded-lg shadow-xs"
          />
        ) : (
          <div className="h-40 w-40 aspect-square bg-muted rounded-lg flex justify-center items-center shadow-xs">
            <p className="text-sm text-muted-foreground">No Image Available</p>
          </div>
        )}

        <div className="flex flex-col gap-1 text-center">
          {/* Title */}
          <h3 className="text-lg font-semibold">{audioFile.name}</h3>

          {/* Narrator */}
          <p className="text-sm text-muted-foreground">
            Narrated by: {audioFile.speaker.displayName} Diaz
          </p>
        </div>
      </div>

      {/* Unified controls (kept) */}
      <div className="flex-row-reverse sm:flex-row flex items-center justify-between gap-3 mb-2">
        <div className="flex-row-reverse sm:flex-row flex items-center gap-3">
          <Button
            className="rounded-full"
            onClick={togglePlay}
            aria-busy={isLoadingToStart ? true : undefined}
            disabled={isLoadingToStart}
            size={"icon"}
          >
            {isPlaying ? (
              <PauseIcon className="size-4 text-background/70 fill-background/80" />
            ) : isLoadingToStart ? (
              <span className="inline-flex items-center gap-2">
                <span className="text-xs tabular-nums min-w-[5em] inline-block animate-pulse ">
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

          <span className="tabular-nums text-sm md:text-base">
            {formatTime(uiCurrentTime)} / {formatTime(uiDuration)}
          </span>
        </div>

        <div className="flex justify-between gap-2 items-center">
          {audioFile.text && (
            <span className="text-xs text-muted-foreground md:flex hidden">
              {(() => {
                const charCount = audioFile.text.length;
                const cost = ((charCount * 10) / 1_000_000).toFixed(4);
                return `${charCount} chars - $${cost}`;
              })()}
            </span>
          )}
          <div className="flex gap-2 items-center">
            <div className="hidden md:block">
              <FavoriteButton af={audioFile} />
            </div>
            <div className="hidden md:block">
              <CopyButton
                info={"Copy transcript"}
                text={audioFile.text ?? ""}
              />
            </div>
            {audioFile.public && <ShareButton />}
            <div>
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
                  <p>Download MP3</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <div className="md:hidden">
              <FavoriteButton af={audioFile} />
            </div>
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
          onValueChange={([v]) => {
            if (v == null) return;
            const clamped = clampPlayable(v, uiDuration || v);
            desiredStartRef.current = clamped;
            setCurrentTime(clamped);
            const video = videoRef.current;
            if (video) {
              video.currentTime = clamped;
            }
          }}
          onValueCommit={([v]) => {
            if (v == null) return;
            const clamped = clampPlayable(v, uiDuration || v);
            setCurrentTime(clamped);
            const video = videoRef.current;
            if (video) {
              video.currentTime = clamped;
            }
          }}
          className="w-full h-10"
          disabled={!resolvedUrl}
        />
        {isStitching && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="px-4 py-1 rounded bg-background/80 text-primary font-semibold text-sm animate-pulse shadow-lg border border-primary">
              Stitching & Uploading...
            </span>
          </div>
        )}
      </div>

      {/* Animated progress bar for chunk processing */}
      {!isAllProcessed && totalChunks > 0 && (
        <div className="w-full py-4">
          <div
            className={cn(
              "h-4 rounded-md transition-all",
              isError
                ? "bg-red-500 animate-pulse"
                : "bg-primary/70 animate-pulse"
            )}
            style={{ width: `${progressPercent}%` }}
          />
          <div className="flex justify-between text-xs mt-1">
            <span>
              {isError
                ? `${errorChunks} error${errorChunks > 1 ? "s" : ""}`
                : `${processedChunks} / ${totalChunks} processed`}
            </span>
            <span>{progressPercent}%</span>
          </div>
        </div>
      )}

      {/* Transcript snippet and retry are unavailable without chunk data */}
      {audioFile.text && (
        <>
          <div className="w-full">
            <div
              className={
                showFullText
                  ? "whitespace-pre-line break-words"
                  : "whitespace-pre-line break-words line-clamp-10"
              }
              style={{ wordBreak: "break-word" }}
            >
              {audioFile.text}
            </div>
            {!showFullText && (
              <button
                className="mt-1 text-xs text-primary underline cursor-pointer"
                onClick={() => setShowFullText(true)}
              >
                View More
              </button>
            )}
            {showFullText && (
              <button
                className="mt-1 text-xs text-primary underline cursor-pointer"
                onClick={() => setShowFullText(false)}
              >
                Show Less
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
});
export default AudioClip;
