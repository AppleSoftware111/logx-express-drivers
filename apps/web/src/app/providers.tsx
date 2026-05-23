'use client';

import type { JSX, ReactNode } from 'react';

import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { QueryClientProvider } from '@tanstack/react-query';

import { queryClient } from '@/lib/queryClient';

export function Providers({ children }: { children: ReactNode }): JSX.Element {
  return (
    <QueryClientProvider client={queryClient}>
      {children as JSX.Element}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
