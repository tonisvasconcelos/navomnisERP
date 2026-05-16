import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '@/features/auth/auth-store';
import { env } from '@/env';

const baseURL = env.VITE_API_URL;

export const api = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: false,
});

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = useAuthStore.getState().accessToken;
  const tenantId = useAuthStore.getState().tenantId;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  if (tenantId) {
    config.headers['X-Tenant-Id'] = tenantId;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config;
    if (error.response?.status === 401 && original && !(original as { _retry?: boolean })._retry) {
      (original as { _retry?: boolean })._retry = true;
      const refresh = useAuthStore.getState().refreshToken;
      if (refresh) {
        try {
          const { data } = await axios.post(`${baseURL}/auth/refresh`, { refreshToken: refresh });
          const body = data?.data ?? data;
          useAuthStore.getState().setSession({
            accessToken: body.accessToken,
            refreshToken: body.refreshToken,
            tenantId: body.tenantId,
          });
          original.headers.Authorization = `Bearer ${body.accessToken}`;
          return api(original);
        } catch {
          useAuthStore.getState().clear();
        }
      }
    }
    return Promise.reject(error);
  },
);
