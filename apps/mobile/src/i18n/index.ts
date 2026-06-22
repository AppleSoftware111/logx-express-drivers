import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Localization from 'expo-localization';
import { createInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';

import {
  DEFAULT_LOCALE,
  isSupportedLocale,
  loadFlatMessages,
  LOCALE_COOKIE_NAME,
  type SupportedLocale,
} from '@logx/i18n';
import { setZodLocale } from '@logx/i18n';

const resources = {
  pt: { translation: loadFlatMessages('pt') },
  es: { translation: loadFlatMessages('es') },
  en: { translation: loadFlatMessages('en') },
};
const i18n = createInstance();

function deviceLocaleHint(): SupportedLocale {
  const tag = Localization.getLocales()[0]?.languageCode?.toLowerCase();
  if (tag?.startsWith('pt')) return 'pt';
  if (tag?.startsWith('es')) return 'es';
  if (tag?.startsWith('en')) return 'en';
  return DEFAULT_LOCALE;
}

export async function initI18n(): Promise<SupportedLocale> {
  const stored = await AsyncStorage.getItem(LOCALE_COOKIE_NAME);
  const locale = isSupportedLocale(stored) ? stored : deviceLocaleHint();

  if (!i18n.isInitialized) {
    await i18n.use(initReactI18next).init({
      resources,
      lng: locale,
      fallbackLng: DEFAULT_LOCALE,
      interpolation: { escapeValue: false, prefix: '{', suffix: '}' },
      compatibilityJSON: 'v4',
    });
  } else {
    await i18n.changeLanguage(locale);
  }

  setZodLocale(locale);
  return locale;
}

export async function setAppLocale(locale: SupportedLocale): Promise<void> {
  await AsyncStorage.setItem(LOCALE_COOKIE_NAME, locale);
  await i18n.changeLanguage(locale);
  setZodLocale(locale);
}

export { i18n };
