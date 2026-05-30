'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Truck } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { LanguageSwitcher } from '@/components/layout/LanguageSwitcher';
import { cn } from '@/lib/utils';

export function PortalHeader() {
  const pathname = usePathname();
  const t = useTranslations('nav');
  const tPortal = useTranslations('portal');
  const tCommon = useTranslations('common');

  const portalNav = [
    { href: '/portal/dashboard', label: t('portalDashboard') },
    { href: '/portal/deliveries', label: t('portalDeliveries') },
    { href: '/portal/tracking', label: t('portalTracking') },
    { href: '/portal/pod', label: t('portalPod') },
  ];

  return (
    <header className="bg-white border-b border-gray-200">
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
            <Truck className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="font-bold text-gray-900">{tCommon('appName')}</span>
          <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded font-medium">
            {tPortal('portalBadge')}
          </span>
        </div>
        <nav className="flex items-center gap-1">
          {portalNav.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                'px-3 py-1.5 rounded-lg text-sm transition-colors',
                pathname.startsWith(href)
                  ? 'bg-blue-50 text-blue-700 font-medium'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              )}
            >
              {label}
            </Link>
          ))}
        </nav>
        <LanguageSwitcher className="w-[130px]" />
      </div>
    </header>
  );
}
