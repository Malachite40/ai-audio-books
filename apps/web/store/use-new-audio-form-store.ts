import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export interface NewAudioFormState {
  text: string;
  setText: (text: string) => void;
  speakerId: string | undefined;
  setSpeakerId: (speakerId: string | undefined) => void;
  durationMinutes: number;
  setDurationMinutes: (duration: number) => void;
  name: string;
  setName: (name: string) => void;
}

export const useNewAudioFormStore = create<NewAudioFormState>()(
  persist(
    (set) => ({
      text: "",
      setText: (text: string) => set({ text }),
      speakerId: undefined,
      setSpeakerId: (speakerId: string | undefined) => set({ speakerId }),
      durationMinutes: 10,
      setDurationMinutes: (duration: number) =>
        set({ durationMinutes: duration }),
      name: "",
      setName: (name: string) => set({ name }),
    }),
    {
      name: "textInputStore",
      storage: createJSONStorage(() => localStorage),
    }
  )
);
