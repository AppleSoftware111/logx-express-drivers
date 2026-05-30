import { DEFAULT_LOCALE, isSupportedLocale, type SupportedLocale } from './locales';

/** Parse Accept-Language header (e.g. "pt-BR,en;q=0.9") → supported locale */
export function resolveLocaleFromAcceptLanguage(header: string | undefined): SupportedLocale {
  if (!header) return DEFAULT_LOCALE;

  const parts = header.split(',').map((part) => {
    const [lang, qPart] = part.trim().split(';');
    const q = qPart?.startsWith('q=') ? parseFloat(qPart.slice(2)) : 1;
    return { lang: lang.toLowerCase(), q };
  });

  parts.sort((a, b) => b.q - a.q);

  for (const { lang } of parts) {
    if (lang.startsWith('pt')) return 'pt';
    if (lang.startsWith('es')) return 'es';
    if (lang.startsWith('en')) return 'en';
  }

  return DEFAULT_LOCALE;
}

export function resolveLocale(
  cookieValue: string | undefined,
  acceptLanguage: string | undefined
): SupportedLocale {
  if (isSupportedLocale(cookieValue)) return cookieValue;
  return resolveLocaleFromAcceptLanguage(acceptLanguage);
}
