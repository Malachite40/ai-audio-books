"use client";
import { Button } from "@workspace/ui/components/button";
import { Slider } from "@workspace/ui/components/slider"; // Assuming a Slider component for progress
import { Download, PauseIcon, PlayIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface AudioPlayerProps {
  src: string;
}

const AudioPlayer = ({ src }: AudioPlayerProps) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState<number | undefined>(0);
  const [duration, setDuration] = useState<number | undefined>(0);
  const [error, setError] = useState<string | null>(null);
  const [isSeeking, setIsSeeking] = useState(false);

  // whenever src changes, load it
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.src = src;
    audio.load();
    setError(null);
    setIsPlaying(false);
  }, [src]);

  // attach listeners
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => {
      if (!isSeeking && typeof audio.currentTime === "number") {
        setCurrentTime(audio.currentTime);
      }
    };
    const onLoadedMeta = () => {
      if (typeof audio.duration === "number") {
        setDuration(audio.duration);
      }
    };
    const onEnded = () => setIsPlaying(false);
    const onError = () => {
      const code = audio.error?.code;
      let msg = "Playback error";
      if (code === MediaError.MEDIA_ERR_DECODE) {
        msg = "Format not supported by browser";
      }
      setError(msg);
      setIsPlaying(false);
    };

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("loadedmetadata", onLoadedMeta);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);

    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("loadedmetadata", onLoadedMeta);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
    };
  }, [isSeeking]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play().catch((e) => setError(`Playback error: ${e.message}`));
      setIsPlaying(true);
    }
  };

  const formatTime = (t: number | undefined) => {
    if (t === undefined || isNaN(t) || t === Infinity) return "0:00";
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60)
      .toString()
      .padStart(2, "0");
    return `${m}:${s}`;
  };

  const handleSeekStart = () => {
    setIsSeeking(true);
  };

  const handleSeek = (value: number[]) => {
    const audio = audioRef.current;
    if (!audio) return;
    setCurrentTime(value[0]);
  };

  const handleSeekEnd = (value: number[]) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = value[0] ?? 0;
    setCurrentTime(value[0]);
    setIsSeeking(false);
  };

  return (
    <div className="w-full rounded-md border p-4 shadow-sm">
      <audio ref={audioRef} preload="metadata" src={src} />
      <div className="flex flex-col space-y-2">
        {error && <div className="text-red-500 text-sm">{error}</div>}
        <div className="flex items-center space-x-4">
          {" "}
          {/* Increased spacing */}
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={togglePlay}
            disabled={
              !src || !!error || duration === undefined || duration === 0
            } // Disable if no src or error or duration is 0 or undefined
            className="h-12 w-12 rounded-full" // Larger button
          >
            {isPlaying ? <PauseIcon size={24} /> : <PlayIcon size={24} />}{" "}
            {/* Larger icons */}
          </Button>
          <span className="text-sm font-mono">{formatTime(currentTime)}</span>{" "}
          {/* Monospaced font for time */}
          <Slider
            value={[currentTime ?? 0]} // Provide default value for slider
            max={duration ?? 0} // Provide default value for slider
            step={0.1}
            onValueChange={handleSeek}
            onValueCommit={handleSeekEnd}
            onPointerDown={handleSeekStart}
            disabled={
              !src || !!error || duration === undefined || duration === 0
            } // Disable slider
            className="flex-1"
          />
          <span className="text-sm font-mono">{formatTime(duration)}</span>{" "}
          {/* Monospaced font for time */}
          {src && (
            <a href={src} download="audio.mp3" className="h-12 w-12">
              {" "}
              {/* Larger clickable area */}
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-12 w-12 rounded-full" // Larger button
                disabled={!!error}
              >
                <Download size={24} /> {/* Larger icon */}
              </Button>
            </a>
          )}
        </div>
      </div>
    </div>
  );
};

export default AudioPlayer;
