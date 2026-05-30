import { create } from 'zustand';

import type { SupportedLocale } from '@logx/i18n';

import { setAppLocale } from '../i18n';

interface LocaleState {
  locale: SupportedLocale;
  setLocale: (locale: SupportedLocale) => Promise<void>;
}

export const useLocaleStore = create<LocaleState>((set) => ({
  locale: 'pt',
  setLocale: async (locale) => {
    await setAppLocale(locale);
    set({ locale });
  },
}));
