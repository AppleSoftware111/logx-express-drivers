import type { SupportedLocale } from './locales';
import { localeToIntl } from './locales';

type FormatInput = Date | string | number;

function normalizeDate(value: FormatInput): Date {
  return value instanceof Date ? value : new Date(value);
}

export function formatDateByLocale(
  value: FormatInput,
  locale: SupportedLocale,
  options?: Intl.DateTimeFormatOptions
): string {
  return new Intl.DateTimeFormat(localeToIntl(locale), options).format(normalizeDate(value));
}

export function formatDateTimeByLocale(
  value: FormatInput,
  locale: SupportedLocale,
  options?: Intl.DateTimeFormatOptions
): string {
  return formatDateByLocale(value, locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    ...options,
  });
}

export function formatTimeByLocale(
  value: FormatInput,
  locale: SupportedLocale,
  options?: Intl.DateTimeFormatOptions
): string {
  return formatDateByLocale(value, locale, {
    hour: '2-digit',
    minute: '2-digit',
    ...options,
  });
}
