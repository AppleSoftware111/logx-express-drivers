'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BarChart3,
  Bell,
  FileText,
  LayoutDashboard,
  LogOut,
  Map,
  Navigation,
  Settings,
  Truck,
  Users,
} from 'lucide-react';
import { useTranslations } from 'next-intl';

import { LanguageSwitcher } from '@/components/layout/LanguageSwitcher';
import { cn } from '@/lib/utils';
import { useLogout } from '@/hooks/useAuth';
import { useAuthStore } from '@/stores/authStore';
import { getUserRoleLabel } from '@logx/i18n';
import type { SupportedLocale } from '@logx/i18n';
import { useLocale } from 'next-intl';

export function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuthStore();
  const { mutate: logout } = useLogout();
  const t = useTranslations('nav');
  const tCommon = useTranslations('common');
  const tAuth = useTranslations('auth');
  const locale = useLocale() as SupportedLocale;

  const navItems = [
    { href: '/dashboard', label: t('dashboard'), icon: LayoutDashboard },
    { href: '/operations', label: t('operations'), icon: Map },
    { href: '/routes', label: t('routes'), icon: Navigation },
    { href: '/executions', label: t('executions'), icon: Truck },
    { href: '/drivers', label: t('drivers'), icon: Users },
    { href: '/clients', label: t('clients'), icon: FileText },
    { href: '/reports', label: t('reports'), icon: BarChart3 },
    { href: '/alerts', label: t('alerts'), icon: Bell },
    { href: '/settings', label: t('settings'), icon: Settings },
  ];

  return (
    <aside className="flex flex-col w-64 min-h-screen bg-gray-900 text-white shrink-0">
      <div className="border-b border-gray-800 px-4 py-4">
        <div className="rounded-2xl bg-white/95 p-3 shadow-lg">
          <img
            src="/logo-biopoli-ui.svg"
            alt={tCommon('appName')}
            className="h-12 w-full object-contain"
          />
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="px-3 pb-4 border-t border-gray-800 pt-4 space-y-3">
        <LanguageSwitcher className="w-full bg-gray-800 border-gray-700 text-white" />
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold uppercase">
            {user?.email?.slice(0, 2) ?? 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-white truncate">{user?.email}</p>
            <p className="text-xs text-gray-400">
              {user?.role ? getUserRoleLabel(user.role, locale) : ''}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => logout()}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          {tAuth('logout')}
        </button>
      </div>
    </aside>
  );
}
