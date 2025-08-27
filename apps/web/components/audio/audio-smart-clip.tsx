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

  // Small “beep” to help users confirm audio after flipping Silent Mode
  async function soundCheck() {
    try {
      const AC: typeof AudioContext =
        (window as any).AudioContext || (window as any).webkitAudioContext;
      const ctx = new AC();
      await ctx.resume();

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain).connect(ctx.destination);

      const now = ctx.currentTime + 0.02;
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.22, now + 0.05);
      gain.gain.linearRampToValueAtTime(0.0001, now + 0.25);

      osc.frequency.setValueAtTime(880, now);
      osc.start(now);
      osc.stop(now + 0.27);

      osc.onended = () => {
        try {
          osc.disconnect();
          gain.disconnect();
          ctx.close();
        } catch {}
      };
    } catch {
      // no-op
    }
  }

  return (
    <>
      {isIOSMobileSafari && showNotice && (
        <div className="space-y-3">
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-900 mb-6">
            <div className="font-semibold mb-1">
              Heads up: iPhone Silent Mode can mute web audio
            </div>
            <p className="text-sm leading-relaxed">
              On iOS Safari, the side switch (or Silent Mode in Control Center)
              mutes webpage audio. We can&apos;t override this from the browser.
              Flip the switch to <span className="font-medium">Ring</span> or
              disable Silent Mode, then press{" "}
              <span className="font-medium">Play</span>.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant="outline" onClick={soundCheck}>
                Sound check (short beep)
              </Button>
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
