// ──────────────────────────────────────────────────────────────────────────────
// File: components/AudioPlaybackSettingsButton.tsx
// ──────────────────────────────────────────────────────────────────────────────

"use client";

import { useMediaQuery } from "@/hooks/use-media-query";
import { useAudioPlaybackStore } from "@/store/use-audio-playback-store";
import * as React from "react";

import { MEDIA_QUERY } from "@/lib/constants";
import { Button } from "@workspace/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@workspace/ui/components/dialog";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@workspace/ui/components/drawer";
import { Label } from "@workspace/ui/components/label";
import { Slider } from "@workspace/ui/components/slider";
import { SettingsIcon } from "lucide-react";

// ── HOISTED OUTSIDE so it doesn't remount on every parent re-render ──────────
type PlaybackSettingsFormProps = {
  playbackRate: number;
  applyRate: (v: number) => void;
  className?: string;
};

const PlaybackSettingsForm = React.memo(function PlaybackSettingsForm({
  playbackRate,
  applyRate,
  className = "",
}: PlaybackSettingsFormProps) {
  return (
    <form className={`grid items-start gap-4 ${className}`}>
      <div className="flex items-center justify-between">
        <Label htmlFor="playback-speed" className="text-sm">
          Speed
        </Label>
        <div
          className="text-sm tabular-nums"
          aria-live="polite"
          aria-atomic="true"
        >
          {playbackRate.toFixed(2)}×
        </div>
      </div>

      <Slider
        id="playback-speed"
        value={[playbackRate]}
        onValueChange={([v]) => {
          if (typeof v === "number") applyRate(v);
        }}
        min={0.5}
        max={2}
        step={0.05}
        aria-label="Playback speed"
      />

      {/* Quick presets */}
      <div className="mt-2 flex flex-wrap gap-2 justify-between">
        {[0.75, 1, 1.25, 1.5, 1.75, 2].map((v) => (
          <Button
            key={v}
            type="button" // ← prevent implicit submit
            variant={
              Math.abs(playbackRate - v) < 0.0001 ? "default" : "outline"
            }
            onClick={() => applyRate(v)}
            aria-pressed={Math.abs(playbackRate - v) < 0.0001}
          >
            {v}
          </Button>
        ))}
      </div>
    </form>
  );
});

export function AudioSettingsButton() {
  const [open, setOpen] = React.useState(false);
  const isDesktop = useMediaQuery(MEDIA_QUERY.MD);

  const playbackRate = useAudioPlaybackStore((s) => s.playbackRate);
  const setPlaybackRate = useAudioPlaybackStore((s) => s.setPlaybackRate);

  // Clamp & round helper so the store only sees sane values.
  const applyRate = React.useCallback(
    (v: number) => {
      const clamped = Math.min(2, Math.max(0.5, v));
      const rounded = Math.round(clamped * 100) / 100; // 2 decimal places
      setPlaybackRate(rounded);
    },
    [setPlaybackRate]
  );

  const Trigger = (
    <Button variant="ghost" size="icon" aria-label="Open playback settings">
      <SettingsIcon className="size-4" />
    </Button>
  );

  if (isDesktop) {
    // Desktop: Dialog
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>{Trigger}</DialogTrigger>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Playback settings</DialogTitle>
            <DialogDescription>
              Adjust the audio playback speed. Your choice is saved
              automatically.
            </DialogDescription>
          </DialogHeader>
          <PlaybackSettingsForm
            playbackRate={playbackRate}
            applyRate={applyRate}
          />
        </DialogContent>
      </Dialog>
    );
  }

  // Mobile: Drawer
  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>{Trigger}</DrawerTrigger>
      <DrawerContent>
        <DrawerHeader className="text-left">
          <DrawerTitle>Playback settings</DrawerTitle>
          <DrawerDescription>
            Adjust the audio playback speed. Your choice is saved automatically.
          </DrawerDescription>
        </DrawerHeader>

        <PlaybackSettingsForm
          playbackRate={playbackRate}
          applyRate={applyRate}
          className="px-4"
        />

        <DrawerFooter className="pt-2">
          <DrawerClose asChild>
            <Button variant="outline">Done</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
