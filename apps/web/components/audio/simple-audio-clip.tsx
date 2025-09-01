// components/SimpleAudioClip.tsx
"use client";

import type { AudioFile } from "@workspace/database";
import { Button } from "@workspace/ui/components/button";
import { Pause, Play } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

type Props = { af: AudioFile; label?: string };

function formatTime(sec: number) {
  if (!Number.isFinite(sec) || sec <= 0) return "00:00";
  const s = Math.floor(sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return h > 0
    ? `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")}`
    : `${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

export default function SimpleAudioClip(props: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);

  // Stable key for the current source; used to reload the <audio> when it changes
  const sourceKey = useMemo(
    () => ("src" in props ? props.src : `af:${props.af.id}`),
    [props]
  );

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    // Reset & force the browser to re-parse <source> children
    setIsPlaying(false);
    setCurrent(0);
    setDuration(0);
    el.pause();
    el.load();
  }, [sourceKey]);

  const toggle = () => {
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) {
      el.play().catch(() => {});
    } else {
      el.pause();
    }
  };

  const label =
    "label" in props
      ? props.label
      : "af" in props
        ? (props.af.name ?? props.af.id)
        : undefined;

  return (
    <div className="inline-flex items-center gap-3">
      <Button
        className="rounded-full"
        type="button"
        onClick={toggle}
        aria-label={isPlaying ? "Pause" : "Play"}
        size="icon"
      >
        {isPlaying ? (
          <Pause className="h-4 w-4 text-background/70 fill-background/80" />
        ) : (
          <Play className="h-4 w-4 text-background/70 fill-background/80" />
        )}
      </Button>

      <span className="tabular-nums text-sm">
        {formatTime(current)} / {formatTime(duration)}
      </span>

      {/* Hidden/native audio element */}
      <audio
        ref={audioRef}
        preload="metadata"
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
        onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime || 0)}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => setIsPlaying(false)}
      >
        {props.af && (
          <>
            <source
              src={`https://instantaudio.online/audio/${props.af.id}.mp3`}
              type="audio/mpeg"
            />
          </>
        )}
      </audio>

      {label && <span className="sr-only">{label}</span>}
    </div>
  );
}
