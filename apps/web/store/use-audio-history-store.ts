import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

interface AudioHistoryState {
  open: boolean;
  selectedTab: string;
  setSelectedTab: (tab: string) => void;
  setOpen: (value: boolean) => void;
}

export const useAudioHistoryStore = create<AudioHistoryState>()(
  persist(
    (set) => ({
      open: false,
      selectedTab: "my-creations",
      setSelectedTab: (tab: string) => set({ selectedTab: tab }),
      setOpen: (value: boolean) => set({ open: value }),
    }),
    {
      name: "audioHistoryStore",
      storage: createJSONStorage(() => localStorage),
    }
  )
);
