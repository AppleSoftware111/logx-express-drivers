'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';

import { isSupportedLocale, LOCALE_COOKIE_NAME, type SupportedLocale } from '@logx/i18n';

export async function setLocaleAction(locale: string): Promise<void> {
  if (!isSupportedLocale(locale)) return;
  const cookieStore = await cookies();
  cookieStore.set(LOCALE_COOKIE_NAME, locale as SupportedLocale, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  });
  revalidatePath('/', 'layout');
}
