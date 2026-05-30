'use client';

import { useQuery, useMutation } from '@tanstack/react-query';
import { Bell, CheckCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { apiClient } from '@/lib/api';
import { queryClient } from '@/lib/queryClient';
import { formatDateTime } from '@/lib/utils';

interface Alert {
  _id: string;
  type: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  executionId?: { scheduledDate: string; routeId: string };
}

const ALERT_TYPE_COLORS: Record<string, string> = {
  DELAY_15: 'bg-yellow-100 text-yellow-700',
  DELAY_30: 'bg-orange-100 text-orange-700',
  DELAY_60: 'bg-red-100 text-red-700',
  GEOFENCE: 'bg-blue-100 text-blue-700',
  DRIVER_OFFLINE: 'bg-gray-100 text-gray-700',
};

export default function AlertsPage() {
  const t = useTranslations('alerts');
  const { data, isLoading } = useQuery({
    queryKey: ['alerts'],
    queryFn: async () => {
      const res = await apiClient.get<{ success: boolean; data: Alert[] }>('/alerts?limit=100');
      return res.data.data;
    },
    refetchInterval: 15_000,
  });

  const markRead = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.patch(`/alerts/${id}/read`);
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['alerts'] }),
  });

  const markAllRead = useMutation({
    mutationFn: async () => {
      await apiClient.patch('/alerts/read-all');
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['alerts'] }),
  });

  const unread = data?.filter((a) => !a.isRead).length ?? 0;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {unread > 0 ? `${unread} unread alert${unread > 1 ? 's' : ''}` : 'All caught up'}
          </p>
        </div>
        {unread > 0 && (
          <button
            onClick={() => markAllRead.mutate()}
            disabled={markAllRead.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200 transition-colors"
          >
            <CheckCheck className="w-4 h-4" />
            Mark all read
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full" />
          </div>
        )}
        {!isLoading && data?.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <Bell className="w-10 h-10 mb-3 opacity-30" />
            <p>No alerts yet</p>
          </div>
        )}
        {data?.map((alert) => (
          <div
            key={alert._id}
            className={`flex items-start gap-4 px-5 py-4 hover:bg-gray-50 transition-colors ${
              !alert.isRead ? 'bg-blue-50/30' : ''
            }`}
          >
            <div
              className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${alert.isRead ? 'bg-gray-200' : 'bg-blue-500'}`}
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span
                  className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    ALERT_TYPE_COLORS[alert.type] ?? 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {alert.type.replace('_', ' ')}
                </span>
              </div>
              <p className="text-sm text-gray-900">{alert.message}</p>
              <p className="text-xs text-gray-400 mt-1">{formatDateTime(alert.createdAt)}</p>
            </div>
            {!alert.isRead && (
              <button
                onClick={() => markRead.mutate(alert._id)}
                className="text-xs text-blue-600 hover:underline shrink-0"
              >
                Mark read
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
