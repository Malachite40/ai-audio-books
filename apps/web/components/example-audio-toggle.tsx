"use client";

import { Button } from "@workspace/ui/components/button";
import { cn } from "@workspace/ui/lib/utils";
import { Pause, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type ExampleAudioToggleProps = {
  /** Example audio URL for the currently selected speaker */
  exampleUrl?: string;
  /** Current speaker id; used to auto-stop on change */
  speakerId?: string | null;
  /** Disable the button (e.g., while loading) */
  disabled?: boolean;
  className?: string;
};

export default function ExampleAudioToggle({
  exampleUrl,
  speakerId,
  disabled,
  className,
}: ExampleAudioToggleProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  // Wire up audio element events
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => setIsPlaying(false);

    el.addEventListener("play", onPlay);
    el.addEventListener("pause", onPause);
    el.addEventListener("ended", onEnded);

    return () => {
      el.removeEventListener("play", onPlay);
      el.removeEventListener("pause", onPause);
      el.removeEventListener("ended", onEnded);
    };
  }, []);

  // Stop & reset audio when speaker changes
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    el.pause();
    el.currentTime = 0;
    setIsPlaying(false);
  }, [speakerId]);

  // Safety pause on unmount
  useEffect(() => {
    return () => {
      audioRef.current?.pause();
    };
  }, []);

  const toggle = () => {
    const el = audioRef.current;
    if (!el || !exampleUrl) return;

    if (!el.paused && isPlaying) {
      el.pause();
      return;
    }

    el.src = exampleUrl;
    el.play().catch((err) => {
      console.error("Failed to play example audio:", err);
    });
  };

  const isDisabled = disabled || !exampleUrl;

  return (
    <>
      <audio
        ref={audioRef}
        className="hidden"
        aria-hidden="true"
        preload="none"
      />
      <Button
        type="button"
        variant="outline"
        tabIndex={-1}
        aria-label={isPlaying ? "Pause example audio" : "Play example audio"}
        className={cn(
          "p-1 rounded hover:bg-gray-200 flex items-center gap-2",
          className
        )}
        disabled={isDisabled}
        onClick={(e) => {
          e.stopPropagation();
          toggle();
        }}
      >
        {isPlaying ? (
          <Pause className="h-4 w-4" />
        ) : (
          <Play className="h-4 w-4" />
        )}
        <span>{isPlaying ? "Pause" : "Play Example"}</span>
      </Button>
    </>
  );
}
