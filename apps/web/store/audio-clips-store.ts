import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export interface Clip {
  id: string;
  src?: string;
  text?: string;
}

interface AudioClipsState {
  clips: Clip[];
  addClip: (clip: Clip) => void;
  removeClip: (id: string) => void;
  updateClip: (updatedClip: Clip) => void;
}

export const useAudioClipsStore = create<AudioClipsState>()(
  persist(
    (set, get) => ({
      clips: [],
      addClip: (clip) => set((state) => ({ clips: [clip, ...state.clips] })),
      removeClip: (id) =>
        set((state) => ({
          clips: state.clips.filter((clip) => clip.id !== id),
        })),
      updateClip: (updatedClip) =>
        set((state) => ({
          clips: state.clips.map((clip) =>
            clip.id === updatedClip.id ? updatedClip : clip
          ),
        })),
    }),
    {
      name: "audioClipsStore",
      storage: createJSONStorage(() => localStorage),
    }
  )
);
