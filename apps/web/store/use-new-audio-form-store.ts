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
  // Persist the selected language for filtering speakers
  language: string | undefined;
  setLanguage: (language: string | undefined) => void;
  // Indicates when persisted state has rehydrated from storage
  reset: () => void;
  hasHydrated: boolean;
  setHasHydrated: (hydrated: boolean) => void;
}

export const useNewAudioFormStore = create<NewAudioFormState>()(
  persist(
    (set, get) => ({
      hasHydrated: false,
      setHasHydrated: (hydrated: boolean) => set({ hasHydrated: hydrated }),
      text: "",
      setText: (text: string) => set({ text }),
      speakerId: undefined,
      setSpeakerId: (id) =>
        set((s) => {
          if (!id) return s;
          return { ...s, speakerId: id };
        }),
      durationMinutes: 5,
      setDurationMinutes: (duration: number) =>
        set({ durationMinutes: duration }),
      name: "",
      setName: (name: string) => set({ name }),
      language: undefined,
      setLanguage: (language: string | undefined) => set({ language }),
      reset: () =>
        set({
          text: "",
          speakerId: undefined,
          durationMinutes: 5,
          name: "",
        }),
    }),
    {
      name: "textInputStore",
      storage: createJSONStorage(() => localStorage),
      onRehydrateStorage: () => (state, error) => {
        if (!error) {
          // mark hydrated after values are restored
          state?.setHasHydrated?.(true);
        }
      },
    }
  )
);
