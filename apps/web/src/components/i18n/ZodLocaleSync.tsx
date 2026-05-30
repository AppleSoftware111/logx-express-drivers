'use client';

import { setZodLocale, type SupportedLocale } from '@logx/i18n';
import { useLocale } from 'next-intl';
import { useEffect } from 'react';

export function ZodLocaleSync() {
  const locale = useLocale() as SupportedLocale;

  useEffect(() => {
    setZodLocale(locale);
    document.documentElement.lang =
      locale === 'pt' ? 'pt-BR' : locale === 'es' ? 'es' : 'en';
  }, [locale]);

  return null;
}
