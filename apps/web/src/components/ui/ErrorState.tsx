'use client';

import { AlertTriangle, RefreshCw } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({ title, message, onRetry }: ErrorStateProps) {
  const t = useTranslations('common');

  return (
    <div className="flex flex-col items-center justify-center py-20 text-center px-6">
      <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
        <AlertTriangle className="w-5 h-5 text-red-600" />
      </div>
      <p className="text-base font-semibold text-gray-900 mb-1">{title ?? t('errorTitle')}</p>
      <p className="text-sm text-gray-500 max-w-xs mb-5">{message ?? t('errorMessage')}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          {t('retry')}
        </button>
      )}
    </div>
  );
}
