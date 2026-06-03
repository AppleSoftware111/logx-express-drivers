import type { SupportedLocale } from './locales';
import { localeToIntl } from './locales';

type FormatInput = Date | string | number;

function normalizeDate(value: FormatInput): Date | null {
  if (typeof value === 'string' && value.trim().length === 0) {
    return null;
  }

  if (typeof value === 'number' && !Number.isFinite(value)) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDateByLocale(
  value: FormatInput,
  locale: SupportedLocale,
  options?: Intl.DateTimeFormatOptions
): string {
  const date = normalizeDate(value);

  if (!date) {
    return '';
  }

  return new Intl.DateTimeFormat(localeToIntl(locale), options).format(date);
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
