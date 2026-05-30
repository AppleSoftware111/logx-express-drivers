import { cookies, headers } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';

import { loadMessages, LOCALE_COOKIE_NAME, resolveLocale } from '@logx/i18n';

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const headerStore = await headers();
  const locale = resolveLocale(
    cookieStore.get(LOCALE_COOKIE_NAME)?.value,
    headerStore.get('accept-language') ?? undefined
  );

  return {
    locale,
    messages: loadMessages(locale),
  };
});
