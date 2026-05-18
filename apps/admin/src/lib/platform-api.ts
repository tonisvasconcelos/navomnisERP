import axios from 'axios';
import { env } from '@/env';
import { usePlatformAuthStore } from '@/store/auth-store';

const baseURL = env.VITE_API_URL;

export const platformApi = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' },
});

platformApi.interceptors.request.use((config) => {
  const token = usePlatformAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export type ApiEnvelope<T> = { data: T };
