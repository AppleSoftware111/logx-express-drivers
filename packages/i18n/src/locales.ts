export const SUPPORTED_LOCALES = ['pt', 'es', 'en'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: SupportedLocale = 'pt';
export const LOCALE_COOKIE_NAME = 'LOGX_LOCALE';

export function isSupportedLocale(value: string | undefined | null): value is SupportedLocale {
  return value !== undefined && value !== null && SUPPORTED_LOCALES.includes(value as SupportedLocale);
}

export function localeToHtmlLang(locale: SupportedLocale): string {
  switch (locale) {
    case 'pt':
      return 'pt-BR';
    case 'es':
      return 'es';
    case 'en':
      return 'en';
    default:
      return 'pt-BR';
  }
}

export function localeToIntl(locale: SupportedLocale): string {
  switch (locale) {
    case 'pt':
      return 'pt-BR';
    case 'es':
      return 'es-ES';
    case 'en':
      return 'en-US';
    default:
      return 'pt-BR';
  }
}
