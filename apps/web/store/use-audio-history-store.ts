import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

interface AudioHistoryState {
  open: boolean;
  setOpen: (value: boolean) => void;
}

export const useAudioHistoryStore = create<AudioHistoryState>()(
  persist(
    (set) => ({
      open: false,
      setOpen: (value: boolean) => set({ open: value }),
    }),
    {
      name: "audioHistoryStore",
      storage: createJSONStorage(() => localStorage),
    }
  )
);
