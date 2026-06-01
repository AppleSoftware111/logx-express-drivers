'use client';

import { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useTranslations } from 'next-intl';

export default function PortalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('portal');
  const tCommon = useTranslations('common');
  useEffect(() => {
    console.error('[portal-error-boundary]', error);
  }, [error]);

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center max-w-sm px-6">
        <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="w-5 h-5 text-red-600" />
        </div>
        <h2 className="text-base font-semibold text-gray-900 mb-1">{t('loadingFailed')}</h2>
        <p className="text-sm text-gray-500 mb-5">
          {error.message || t('unexpectedError')}
        </p>
        <button
          onClick={reset}
          className="px-5 py-2 bg-blue-700 text-white rounded-lg text-sm font-medium hover:bg-blue-800 transition-colors"
        >
          {tCommon('retry')}
        </button>
      </div>
    </div>
  );
}
