import { DEFAULT_LOCALE, isSupportedLocale, LOCALE_COOKIE_NAME, type SupportedLocale } from '@logx/i18n';

export function getClientLocale(): SupportedLocale {
  if (typeof document === 'undefined') return DEFAULT_LOCALE;
  const match = document.cookie.match(new RegExp(`${LOCALE_COOKIE_NAME}=([^;]+)`));
  const value = match?.[1];
  return isSupportedLocale(value) ? value : DEFAULT_LOCALE;
}
