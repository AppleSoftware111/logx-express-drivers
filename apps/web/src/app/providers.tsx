'use client';

import type { JSX, ReactNode } from 'react';

import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { QueryClientProvider } from '@tanstack/react-query';
import { NextIntlClientProvider, type AbstractIntlMessages } from 'next-intl';

import { ZodLocaleSync } from '@/components/i18n/ZodLocaleSync';
import { queryClient } from '@/lib/queryClient';

type ProvidersProps = {
  children: ReactNode;
  locale: string;
  messages: AbstractIntlMessages;
};

export function Providers({ children, locale, messages }: ProvidersProps): JSX.Element {
  return (
    <NextIntlClientProvider locale={locale} messages={messages} timeZone="America/Sao_Paulo">
      <ZodLocaleSync />
      <QueryClientProvider client={queryClient}>
        {children as JSX.Element}
        <ReactQueryDevtools initialIsOpen={false} />
      </QueryClientProvider>
    </NextIntlClientProvider>
  );
}
