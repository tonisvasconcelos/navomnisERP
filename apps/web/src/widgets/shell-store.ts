import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type ShellState = {
  theme: 'light' | 'dark' | 'system';
  setTheme: (t: 'light' | 'dark' | 'system') => void;
};

export const useShellStore = create<ShellState>()(
  persist(
    (set) => ({
      theme: 'system',
      setTheme: (theme) => set({ theme }),
    }),
    { name: 'navomnis-shell' },
  ),
);
