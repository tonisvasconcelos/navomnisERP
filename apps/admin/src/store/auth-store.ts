import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

type AuthState = {
  accessToken: string | null;
  refreshToken: string | null;
  permissions: string[];
  email: string | null;
  displayName: string | null;
  setSession: (data: {
    accessToken: string;
    refreshToken: string;
    email?: string;
    displayName?: string;
    permissions?: string[];
  }) => void;
  clear: () => void;
};

export const usePlatformAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      permissions: [],
      email: null,
      displayName: null,
      setSession: (data) =>
        set({
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
          email: data.email ?? null,
          displayName: data.displayName ?? null,
          permissions: data.permissions ?? [],
        }),
      clear: () =>
        set({
          accessToken: null,
          refreshToken: null,
          permissions: [],
          email: null,
          displayName: null,
        }),
    }),
    {
      name: 'navomnis-platform-auth',
      storage: createJSONStorage(() => sessionStorage),
    },
  ),
);
