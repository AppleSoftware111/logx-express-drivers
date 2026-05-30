import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { LOCALE_COOKIE_NAME, resolveLocale } from '@logx/i18n';

export default function middleware(request: NextRequest) {
  const response = NextResponse.next();
  const locale = resolveLocale(
    request.cookies.get(LOCALE_COOKIE_NAME)?.value,
    request.headers.get('accept-language') ?? undefined
  );

  // Cookie-based locale strategy: do not rewrite pathname.
  response.cookies.set(LOCALE_COOKIE_NAME, locale, {
    path: '/',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 365,
  });

  return response;
}

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
