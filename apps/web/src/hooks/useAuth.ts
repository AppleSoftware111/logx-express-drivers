'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';

import type { LoginInput } from '@logx/shared';

import { apiClient } from '@/lib/api';
import { getAccessToken, useHasAccessToken } from '@/lib/authToken';
import { queryClient } from '@/lib/queryClient';
import { useAuthStore } from '@/stores/authStore';

export function useLogin() {
  const { setAuth } = useAuthStore();
  const router = useRouter();
  const searchParams = useSearchParams();

  return useMutation({
    mutationFn: async (data: LoginInput) => {
      const res = await apiClient.post<{
        success: boolean;
        data: { accessToken: string; user: { id: string; email: string; role: string; companyId?: string; driverId?: string; clientId?: string } };
      }>('/auth/login', data);
      return res.data.data;
    },
    onSuccess: (data) => {
      localStorage.setItem('accessToken', data.accessToken);
      localStorage.setItem('logx-auth', JSON.stringify({
        state: {
          user: data.user,
          accessToken: data.accessToken,
          isAuthenticated: true,
        },
        version: 0,
      }));

      setAuth(data.user, data.accessToken);

      const redirect = searchParams.get('redirect');
      if (redirect && redirect.startsWith('/') && !redirect.startsWith('/login')) {
        router.push(redirect);
        return;
      }
      const role = data.user.role;
      if (role === 'CLIENT') {
        router.push('/portal/dashboard');
      } else {
        router.push('/dashboard');
      }
    },
  });
}

export function useAuthBootstrap() {
  const router = useRouter();

  return useQuery({
    queryKey: ['auth-bootstrap'],
    queryFn: async () => {
      const token = getAccessToken();
      if (!token) return null;
      const res = await apiClient.get('/auth/me');
      return res.data.data;
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}

export function useLogout() {
  const { logout } = useAuthStore();
  const router = useRouter();

  return useMutation({
    mutationFn: async () => {
      await apiClient.post('/auth/logout');
    },
    onSettled: () => {
      logout();
      queryClient.clear();
      router.push('/login');
    },
  });
}

export function useMe() {
  const hasToken = useHasAccessToken();

  return useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      const res = await apiClient.get('/auth/me');
      return res.data.data;
    },
    enabled: hasToken,
    staleTime: 5 * 60 * 1000,
  });
}