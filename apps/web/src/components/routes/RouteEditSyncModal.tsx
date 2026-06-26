'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export type RouteEditSyncPreviewData = {
  pendingNewStopCount: number;
  pendingNewStops: Array<{
    order: number;
    address: string;
    plannedTime: string;
    type: string;
  }>;
  completedRunCount: number;
};

interface RouteEditSyncModalProps {
  open: boolean;
  preview: RouteEditSyncPreviewData | null;
  isSubmitting: boolean;
  onClose: () => void;
  onKeepCompleted: () => void;
  onCreateFollowUp: (options: { followUpScheduledTime: string; followUpLabel?: string }) => void;
}

export function RouteEditSyncModal({
  open,
  preview,
  isSubmitting,
  onClose,
  onKeepCompleted,
  onCreateFollowUp,
}: RouteEditSyncModalProps) {
  const t = useTranslations('routes');
  const defaultTime = preview?.pendingNewStops[0]?.plannedTime ?? '14:00';
  const [followUpTime, setFollowUpTime] = useState(defaultTime);
  const [followUpLabel, setFollowUpLabel] = useState('');

  if (!preview) return null;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !isSubmitting && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('syncModal.title')}</DialogTitle>
          <DialogDescription>{t('syncModal.body', { count: preview.pendingNewStopCount })}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-medium text-slate-800">{t('syncModal.newStopsTitle')}</p>
            <ul className="mt-2 max-h-40 space-y-2 overflow-y-auto text-sm text-slate-700">
              {preview.pendingNewStops.map((stop) => (
                <li key={`${stop.order}-${stop.address}`} className="flex gap-2">
                  <span className="font-medium text-slate-500">#{stop.order + 1}</span>
                  <span>
                    {stop.address} · {stop.plannedTime}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-3 rounded-xl border border-blue-100 bg-blue-50/60 p-4">
            <p className="text-sm font-medium text-slate-900">{t('syncModal.followUpOptionsTitle')}</p>
            <label className="block text-sm text-slate-700">
              {t('syncModal.followUpTime')}
              <input
                type="time"
                value={followUpTime}
                onChange={(event) => setFollowUpTime(event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                disabled={isSubmitting}
              />
            </label>
            <label className="block text-sm text-slate-700">
              {t('syncModal.followUpLabel')}
              <input
                type="text"
                value={followUpLabel}
                onChange={(event) => setFollowUpLabel(event.target.value)}
                placeholder={t('syncModal.followUpLabelPlaceholder')}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                disabled={isSubmitting}
                maxLength={100}
              />
            </label>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <button
            type="button"
            onClick={onKeepCompleted}
            disabled={isSubmitting}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            {t('syncModal.keepCompleted')}
          </button>
          <button
            type="button"
            onClick={() =>
              onCreateFollowUp({
                followUpScheduledTime: followUpTime,
                followUpLabel: followUpLabel.trim() || undefined,
              })
            }
            disabled={isSubmitting || preview.pendingNewStopCount === 0}
            className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {isSubmitting ? t('savingRoute') : t('syncModal.createFollowUp')}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
