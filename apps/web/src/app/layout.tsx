import type { Metadata } from 'next';
import { cookies, headers } from 'next/headers';
import { Inter } from 'next/font/google';

import {
  loadMessages,
  LOCALE_COOKIE_NAME,
  localeToHtmlLang,
  resolveLocale,
  type SupportedLocale,
} from '@logx/i18n';

import './globals.css';
import { Providers } from './providers';

const inter = Inter({ subsets: ['latin'] });

export async function generateMetadata(): Promise<Metadata> {
  const cookieStore = await cookies();
  const headerStore = await headers();
  const locale = resolveLocale(
    cookieStore.get(LOCALE_COOKIE_NAME)?.value,
    headerStore.get('accept-language') ?? undefined
  );
  const metadataMessages = loadMessages(locale).metadata as Record<string, string>;

  const title = metadataMessages.title ?? 'LOGX Express';
  const titleTemplate = metadataMessages.titleTemplate ?? '%s | LOGX Express';
  const description =
    metadataMessages.description ??
    'Healthcare logistics platform for hospital and laboratory courier operations';

  return {
    title: {
      default: title,
      template: titleTemplate,
    },
    description,
    manifest: '/site.webmanifest',
    themeColor: '#2563eb',
    icons: {
      icon: [
        { url: '/favicon.ico', sizes: 'any' },
        { url: '/favicon.svg', type: 'image/svg+xml' },
        { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
        { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      ],
      apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
    },
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const headerStore = await headers();
  const locale = resolveLocale(
    cookieStore.get(LOCALE_COOKIE_NAME)?.value,
    headerStore.get('accept-language') ?? undefined
  ) as SupportedLocale;
  const messages = loadMessages(locale);

  return (
    <html lang={localeToHtmlLang(locale)} suppressHydrationWarning>
      <body className={inter.className}>
        <Providers locale={locale} messages={messages as import('next-intl').AbstractIntlMessages}>
          {children}
        </Providers>
      </body>
    </html>
  );
}
