import axios from 'axios';

import type { ApiResponse } from '@logx/shared';

import { getClientLocale } from '@/lib/locale';
import { useAuthStore } from '@/stores/authStore';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export const apiClient = axios.create({
  baseURL: `${API_URL}/api`,
  withCredentials: true,
  timeout: 15_000,
});

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
}> = [];

function processQueue(error: unknown, token?: string): void {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) {
      reject(error);
    } else {
      resolve(token);
    }
  });
  failedQueue = [];
}

// Inject access token from store on every request
apiClient.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('accessToken');
    if (stored && config.headers) {
      config.headers.Authorization = `Bearer ${stored}`;
    }
    if (config.headers) {
      config.headers['Accept-Language'] = getClientLocale();
    }
  }
  return config;
});

function isAuthEndpoint(url?: string): boolean {
  if (!url) return false;
  return url.includes('/auth/login') || url.includes('/auth/refresh');
}

// Auto-refresh on 401
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config as typeof error.config & { _retry?: boolean };

    if (error.response?.status === 401 && !originalRequest._retry && !isAuthEndpoint(originalRequest.url)) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return apiClient(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const { data } = await apiClient.post<ApiResponse<{ accessToken: string }>>(
          '/auth/refresh'
        );
        const newToken = data.data?.accessToken;
        if (newToken) {
          useAuthStore.getState().setAccessToken(newToken);
          processQueue(null, newToken);
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return apiClient(originalRequest);
        }
      } catch (refreshError) {
        processQueue(refreshError, undefined);
        useAuthStore.getState().logout();
        if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
          window.location.href = '/login';
        }
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export type { ApiResponse };
