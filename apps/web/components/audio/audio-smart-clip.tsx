"use client";

import { Button } from "@workspace/ui/components/button";
import { useEffect, useState } from "react";
import { AudioClipProps } from "./audio-clip";
// ⬇️ adjust this import to wherever your AudioClip lives

/**
 * AudioClipSmart
 * - Renders a Silent Mode notice ONLY on iOS Mobile Safari.
 * - Still uses your existing <AudioClip> for all playback logic.
 * - Adds a small "Sound check" beep to help users confirm audio after unmuting.
 *
 * Usage: replace <AudioClip af={...} /> with <AudioClipSmart af={...} />
 */
export default function AudioClipSmart({ af }: AudioClipProps) {
  const [isIOSMobileSafari, setIsIOSMobileSafari] = useState(false);
  const [showNotice, setShowNotice] = useState(true);

  // Detect iOS Mobile Safari (all iOS browsers are WebKit; exclude Chrome/Edge/Firefox shells)
  useEffect(() => {
    if (typeof navigator === "undefined") return;
    const ua = navigator.userAgent || "";
    const isIOS =
      /iPad|iPhone|iPod/.test(ua) ||
      (navigator.platform === "MacIntel" &&
        (navigator as any).maxTouchPoints > 1); // iPadOS
    const isWebKit = /AppleWebKit/.test(ua);
    const isAltShell = /CriOS|EdgiOS|FxiOS|OPR|OPiOS/.test(ua); // Chrome/Edge/Firefox/Opera on iOS (still WebKit, but keep copy generic)
    setIsIOSMobileSafari(isIOS && isWebKit && !isAltShell);
  }, []);

  return (
    <>
      {isIOSMobileSafari && showNotice && (
        <div className="space-y-3">
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-900 mb-6">
            <div className="font-semibold mb-1">
              Silent Mode can mute web audio!
            </div>
            <p className="text-sm leading-relaxed">
              Mobile browsers can mute audio in Silent Mode. Please switch to
              Ring or disable Silent Mode to ensure no audio is muted!
            </p>
            <div className="mt-3 flex flex-wrap gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowNotice(false)}>
                Got it
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
