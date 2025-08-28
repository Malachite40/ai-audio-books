import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

interface AudioPlaybackState {
  playbackRate: number; // 0.5–2 (or whatever you allow)
  setPlaybackRate: (rate: number) => void;
}

export const useAudioPlaybackStore = create<AudioPlaybackState>()(
  persist(
    (set) => ({
      playbackRate: 1,
      setPlaybackRate: (rate: number) =>
        set({ playbackRate: Math.max(0.01, rate) }),
    }),
    {
      name: "audioPlaybackStore",
      storage: createJSONStorage(() => localStorage),
      version: 1,
    }
  )
);
