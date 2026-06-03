'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

import { setLocaleAction } from '@/app/actions/locale';
import { apiClient } from '@/lib/api';
import type { SupportedLocale } from '@logx/i18n';
import { SUPPORTED_LOCALES } from '@logx/i18n';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const localeLabels: Record<SupportedLocale, string> = {
  pt: 'Português',
  es: 'Español',
  en: 'English',
};

export function LanguageSwitcher({ className }: { className?: string }) {
  const locale = useLocale() as SupportedLocale;
  const t = useTranslations('common');
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const onChange = (value: string) => {
    startTransition(async () => {
      await setLocaleAction(value);
      if (typeof window !== 'undefined' && localStorage.getItem('accessToken')) {
        await apiClient.patch('/auth/me/preferences', { locale: value }).catch(() => undefined);
      }
      router.refresh();
    });
  };

  return (
    <Select value={locale} onValueChange={onChange} disabled={pending}>
      <SelectTrigger className={className ?? 'w-[140px]'} aria-label={t('language')}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {SUPPORTED_LOCALES.map((loc) => (
          <SelectItem key={loc} value={loc}>
            {localeLabels[loc]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
