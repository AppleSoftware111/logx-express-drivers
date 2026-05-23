'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';

import { apiClient } from '@/lib/api';
import { getAccessToken } from '@/lib/authToken';
import { useAuthStore } from '@/stores/authStore';

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { setAuth, logout } = useAuthStore();
  const [hydrated, setHydrated] = useState(false);
  const [status, setStatus] = useState<AuthStatus>('loading');

  useEffect(() => {
    const finish = () => setHydrated(true);
    if (useAuthStore.persist.hasHydrated()) {
      finish();
      return;
    }
    return useAuthStore.persist.onFinishHydration(finish);
  }, []);

  useEffect(() => {
    if (!hydrated) return;

    let cancelled = false;

    async function validate() {
      const token = getAccessToken();
      if (!token) {
        if (!cancelled) {
          setStatus('unauthenticated');
          router.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
        }
        return;
      }

      try {
        const res = await apiClient.get('/auth/me');
        const user = res.data.data as {
          _id: string;
          email: string;
          role: string;
          companyId?: string | { _id: string };
          driverId?: string;
          clientId?: string;
        };

        if (cancelled) return;

        setAuth(
          {
            id: user._id,
            email: user.email,
            role: user.role,
            companyId:
              typeof user.companyId === 'object' && user.companyId !== null
                ? user.companyId._id
                : (user.companyId as string | undefined),
            driverId: user.driverId?.toString(),
            clientId: user.clientId?.toString(),
          },
          token
        );
        setStatus('authenticated');
      } catch {
        if (cancelled) return;
        logout();
        setStatus('unauthenticated');
        router.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
      }
    }

    void validate();

    return () => {
      cancelled = true;
    };
  }, [hydrated, pathname, router, setAuth, logout]);

  if (!hydrated || status === 'loading') {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  if (status !== 'authenticated') {
    return null;
  }

  return <>{children}</>;
}
