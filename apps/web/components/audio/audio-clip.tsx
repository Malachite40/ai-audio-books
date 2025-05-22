"use client";
import { Clip, useAudioClipsStore } from "@/store/audio-clips-store";
import { api } from "@/trpc/react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@workspace/ui/components/button";
import { Slider } from "@workspace/ui/components/slider";
import { cn } from "@workspace/ui/lib/utils";
import { useEffect, useRef, useState } from "react";
import CopyButton from "../copy-buttont";

export interface AudioClipProps {
  clip: Clip;
}

/**
 * AudioClip – streams an AudioFile in small chunks and keeps UI in-sync.
 *
 * Fixes applied 2025-05-20
 *  • Added deduplication via `seenSequencesRef` so the same chunk is never
 *    counted / scheduled twice when React-Query re-fires.
 */
export const AudioClip = ({ clip }: AudioClipProps) => {
  /* ──────────────────────────
   *  Audio-graph & scheduling
   * ────────────────────────── */
  const audioRef = useRef<AudioContext | null>(null);
  const nextStartRef = useRef<number>(0); // time when next chunk starts
  const nextSeqRef = useRef<number>(0); // next contiguous sequence
  const seenSequencesRef = useRef<Set<number>>(new Set()); // ★ NEW – dedupe

  /* ★ decoded chunks that arrived while not playing */
  const pendingRef = useRef<{ buffer: AudioBuffer; sequence: number }[]>([]);

  /* ★ keeps synchronous read of play state */
  const isPlayingRef = useRef(false);
  const hasBegunRef = useRef(false); // has the user pressed Play once?

  /* ───────────────
   *  UI state
   * ─────────────── */
  const [bufferedDuration, setBufferedDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const startRef = useRef<number>(0); // ctx.currentTime when play started
  const pausedOffset = useRef<number>(0); // cumulated offset while paused

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  const removeClip = useAudioClipsStore((s) => s.removeClip);

  /* ───────────────
   *  Fetch chunks
   * ─────────────── */
  const audioFileQuery = api.audio.chunks.fetchAll.useQuery(
    { audioFileId: clip.id },
    { refetchInterval: 500 }
  );

  const wavFilesQuery = useQuery({
    queryKey: [
      clip.id,
      audioFileQuery.data?.audioFile.AudioChunks.map((c) => c.url),
    ],
    queryFn: async () => {
      if (!audioFileQuery.data) return [] as const;
      const responses = await Promise.all(
        audioFileQuery.data.audioFile.AudioChunks.filter((c) => c.url).map(
          async (chunk) => {
            try {
              const res = await fetch(chunk.url!);
              if (!res.ok) throw new Error("network");
              return { arrayBuffer: await res.arrayBuffer(), chunk } as const;
            } catch {
              return undefined;
            }
          }
        )
      );

      return responses.filter(Boolean) as {
        arrayBuffer: ArrayBuffer;
        chunk: (typeof audioFileQuery.data.audioFile.AudioChunks)[0];
      }[];
    },
    enabled: !!audioFileQuery.data,
    staleTime: 10_000,
  });

  /* ───────────────
   *  Init context
   * ─────────────── */
  useEffect(() => {
    const ctx = new AudioContext();
    audioRef.current = ctx;
    nextStartRef.current = 0;
    return () => void ctx.close();
  }, []);

  /* ─────────────────────────────────────────
   *  Decode a chunk, then queue **or** schedule
   * ───────────────────────────────────────── */
  const AppendAudioChunk = async ({
    arrayBuffer,
    sequence,
  }: {
    arrayBuffer: ArrayBuffer;
    sequence: number;
  }) => {
    /* 🔒 Deduplicate */
    if (seenSequencesRef.current.has(sequence)) return; // ← ignore duplicate
    seenSequencesRef.current.add(sequence);

    const ctx = audioRef.current!;
    const decoded = await ctx.decodeAudioData(arrayBuffer.slice(0));

    /* ★ if NOT playing ------------------------------------------ */
    if (!isPlayingRef.current) {
      pendingRef.current.push({ buffer: decoded, sequence });
      nextSeqRef.current = sequence + 1; // keep contiguity
      setBufferedDuration((d) => d + decoded.duration); // show full length

      /* if playback already started earlier, extend timeline */
      if (hasBegunRef.current) nextStartRef.current += decoded.duration;
      return;
    }

    /* otherwise schedule immediately ---------------------------- */
    const src = ctx.createBufferSource();
    src.buffer = decoded;
    src.connect(ctx.destination);

    const when = Math.max(ctx.currentTime, nextStartRef.current);
    src.start(when);

    nextStartRef.current = when + decoded.duration;
    nextSeqRef.current = sequence + 1;
    setBufferedDuration(nextStartRef.current);
  };

  /* ───────────────────────────────
   *  Bring in new contiguous chunks
   * ─────────────────────────────── */
  useEffect(() => {
    if (!wavFilesQuery.data?.length) return;

    const toSchedule = wavFilesQuery.data
      .filter(({ chunk }) => chunk.sequence >= nextSeqRef.current)
      .sort((a, b) => a.chunk.sequence - b.chunk.sequence);

    (async () => {
      for (const { arrayBuffer, chunk } of toSchedule) {
        if (chunk.sequence !== nextSeqRef.current) break;
        await AppendAudioChunk({ arrayBuffer, sequence: chunk.sequence });
      }
    })();
  }, [wavFilesQuery.data]);

  /* ───────────────────────────────
   *  Flush queued buffers on Play
   * ─────────────────────────────── */
  const flushPending = () => {
    const ctx = audioRef.current!;
    const queued = pendingRef.current.sort((a, b) => a.sequence - b.sequence);

    /* base start time: 0 for first play, otherwise our timeline */
    let when = hasBegunRef.current
      ? Math.max(ctx.currentTime, nextStartRef.current)
      : ctx.currentTime;

    for (const { buffer } of queued) {
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.connect(ctx.destination);
      src.start(when);
      when += buffer.duration;
    }

    if (queued.length) {
      nextStartRef.current = when;
      nextSeqRef.current = queued[queued.length - 1]!.sequence + 1;
      setBufferedDuration(when);
    }

    pendingRef.current = [];
  };

  /* ───────────────
   *  Play / Pause
   * ─────────────── */
  const handlePlay = async () => {
    await audioRef.current?.resume();
    flushPending(); // ★ schedule buffered audio
    startRef.current = audioRef.current!.currentTime;
    setIsPlaying(true);
    hasBegunRef.current = true; // ★ first-play latch
  };

  const handlePause = async () => {
    await audioRef.current?.suspend();
    pausedOffset.current += audioRef.current!.currentTime - startRef.current;
    setIsPlaying(false);
  };

  /* manual append test button */
  const audioChunkIdxRef = useRef<number>(0);
  const handleAppend = () => {
    const idx = audioChunkIdxRef.current;
    const item = wavFilesQuery.data?.[idx];
    if (!item) return;
    AppendAudioChunk({
      arrayBuffer: item.arrayBuffer,
      sequence: item.chunk.sequence,
    });
    audioChunkIdxRef.current = idx + 1;
  };

  /* ─────────────────────────────
   *  Progress clock / slider tick
   * ───────────────────────────── */
  useEffect(() => {
    let raf: number;
    const tick = () => {
      if (isPlaying && audioRef.current) {
        const elapsed =
          audioRef.current.currentTime -
          startRef.current +
          pausedOffset.current;

        if (elapsed < bufferedDuration) {
          setCurrentTime(elapsed);
          raf = requestAnimationFrame(tick);
        } else {
          setCurrentTime(bufferedDuration);
          setIsPlaying(false);
        }
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

  /* ───────────────
   *  JSX
   * ─────────────── */
  return (
    <div className="border rounded-lg p-4">
      <div className="flex justify-between">
        <p className="text-sm italic mb-2 line-clamp-2">
          {audioFileQuery.data?.audioFile.AudioChunks.map((ac) => ac.text).join(
            ""
          )}
        </p>

        <CopyButton
          text={
            audioFileQuery.data?.audioFile.AudioChunks.map(
              (ac) => ac.text
            ).join("") ?? ""
          }
        />
      </div>

      <div className="flex items-center gap-2 mb-2">
        <Button onClick={isPlaying ? handlePause : handlePlay}>
          {isPlaying ? "Pause" : "Play"}
        </Button>
        <span>
          {formatTime(currentTime)} / {formatTime(bufferedDuration)}
        </span>
      </div>

      <Slider
        value={[currentTime]}
        min={0}
        max={bufferedDuration}
        step={0.01}
        onValueChange={([v]) => {
          if (v == null) return;
          setCurrentTime(v);
          pausedOffset.current = v;
          if (isPlaying) {
            handlePause();
            handlePlay();
          }
        }}
        className="w-full mb-2 h-10"
      />

      <Button onClick={handleAppend} className="mb-2">
        Append Chunk
      </Button>

      <div className="py-4 flex">
        {audioFileQuery.data?.audioFile.AudioChunks.map((chunk) => (
          <div
            key={chunk.id}
            onClick={() => {
              audioChunkIdxRef.current = chunk.sequence;
            }}
            className={cn(
              "first:rounded-l-md last:rounded-r-md h-4 w-full cursor-pointer",
              chunk.status === "PROCESSING" &&
                "bg-yellow-500 hover:bg-yellow-500/90",
              chunk.status === "PROCESSED" &&
                "bg-green-500 hover:bg-green-500/90",
              chunk.status === "ERROR" && "bg-red-500 hover:bg-red-500/90",
              chunk.status === "PENDING" && "bg-gray-500 hover:bg-gray-500/90",
              chunk.sequence === audioChunkIdxRef.current && "shadow-lg"
            )}
          />
        ))}
      </div>

      <Button
        variant="destructive"
        onClick={() => removeClip(clip.id)}
        className="mt-2"
      >
        Remove
      </Button>
    </div>
  );
};
