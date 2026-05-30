import { defineRouting } from 'next-intl/routing';

import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from '@logx/i18n';

export const routing = defineRouting({
  locales: [...SUPPORTED_LOCALES],
  defaultLocale: DEFAULT_LOCALE,
  localePrefix: 'never',
  localeCookie: {
    name: 'LOGX_LOCALE',
    maxAge: 60 * 60 * 24 * 365,
  },
});
