import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type AuthState = {
  accessToken: string | null;
  refreshToken: string | null;
  tenantId: string | null;
  setSession: (p: { accessToken: string; refreshToken: string; tenantId: string }) => void;
  clear: () => void;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      tenantId: null,
      setSession: ({ accessToken, refreshToken, tenantId }) =>
        set({ accessToken, refreshToken, tenantId }),
      clear: () => set({ accessToken: null, refreshToken: null, tenantId: null }),
    }),
    { name: 'navomnis-auth' },
  ),
);
