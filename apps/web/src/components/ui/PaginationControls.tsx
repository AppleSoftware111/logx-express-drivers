'use client';

import { useTranslations } from 'next-intl';

interface PaginationControlsProps {
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  currentCount: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export function PaginationControls({
  page,
  totalPages,
  totalItems,
  pageSize,
  currentCount,
  onPageChange,
  className,
}: PaginationControlsProps) {
  const t = useTranslations('common');

  if (totalItems <= 0) return null;

  const startItem = (page - 1) * pageSize + 1;
  const endItem = startItem + currentCount - 1;
  const safeTotalPages = Math.max(1, totalPages);

  return (
    <div
      className={[
        'flex flex-col gap-3 border-t border-gray-100 px-5 py-4 text-sm text-gray-500 md:flex-row md:items-center md:justify-between',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="flex flex-col gap-1 md:flex-row md:items-center md:gap-3">
        <span>{t('showingRange', { start: startItem, end: endItem, total: totalItems })}</span>
        <span className="hidden text-gray-300 md:inline">•</span>
        <span>{t('pageOf', { page, totalPages: safeTotalPages })}</span>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="rounded-lg border border-gray-200 px-3 py-1.5 text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {t('previous')}
        </button>
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= safeTotalPages}
          className="rounded-lg border border-gray-200 px-3 py-1.5 text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {t('next')}
        </button>
      </div>
    </div>
  );
}
