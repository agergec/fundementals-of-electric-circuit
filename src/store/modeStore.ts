import { create } from 'zustand';

export type CircuitMode = 'structured' | 'free';

interface ModeStore {
  mode: CircuitMode;
  setMode: (mode: CircuitMode) => void;
}

export const useModeStore = create<ModeStore>((set) => ({
  mode: 'free',
  setMode: (mode) => set({ mode }),
}));
