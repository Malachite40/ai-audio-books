// stores/use-audio-visibility-pref.ts
"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

interface AudioVisibilityPrefState {
  /** null => no saved preference yet */
  preferredIsPublic: boolean | null;
  setPreferredIsPublic: (value: boolean) => void;
  clearPreferredIsPublic: () => void;
}

export const useAudioVisibilityPrefStore = create<AudioVisibilityPrefState>()(
  persist(
    (set) => ({
      preferredIsPublic: null,
      setPreferredIsPublic: (value) => set({ preferredIsPublic: value }),
      clearPreferredIsPublic: () => set({ preferredIsPublic: null }),
    }),
    {
      name: "audioVisibilityPref",
      storage: createJSONStorage(() => localStorage),
    }
  )
);
