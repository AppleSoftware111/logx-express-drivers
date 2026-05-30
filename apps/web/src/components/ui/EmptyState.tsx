'use client';

import type { LucideIcon } from 'lucide-react';
import { Inbox } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface EmptyStateProps {
  Icon?: LucideIcon;
  title?: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({ Icon = Inbox, title, description, action }: EmptyStateProps) {
  const t = useTranslations('common');

  return (
    <div className="flex flex-col items-center justify-center py-20 text-center px-6">
      <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-4">
        <Icon className="w-5 h-5 text-gray-400" />
      </div>
      <p className="text-base font-semibold text-gray-900 mb-1">{title ?? t('emptyTitle')}</p>
      <p className="text-sm text-gray-500 max-w-xs">{description ?? t('emptyDescription')}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
