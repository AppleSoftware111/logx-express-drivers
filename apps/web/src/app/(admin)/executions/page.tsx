'use client';

import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';

import { getExecutionStatusLabel, type SupportedLocale } from '@logx/i18n';
import { SOCKET_EVENTS } from '@logx/shared';
import { apiClient } from '@/lib/api';
import { useSocket } from '@/hooks/useSocket';
import { formatDateTime, getDelayColor, getDelayLabel, getStatusColor } from '@/lib/utils';

export default function ExecutionsPage() {
  const t = useTranslations('executions');
  const locale = useLocale() as SupportedLocale;
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [status, setStatus] = useState('');
  const queryClient = useQueryClient();
  const { socket } = useSocket();

  const { data, isLoading } = useQuery({
    queryKey: ['executions', date, status],
    queryFn: async () => {
      const params = new URLSearchParams({ date });
      if (status) params.set('status', status);
      const res = await apiClient.get(`/executions?${params.toString()}`);
      return res.data;
    },
    refetchInterval: 30_000,
    refetchOnReconnect: true,
  });

  useEffect(() => {
    if (!socket) return;

    const handleExecutionUpdate = () => {
      void queryClient.invalidateQueries({ queryKey: ['executions'] });
      void queryClient.invalidateQueries({ queryKey: ['today-executions'] });
    };

    socket.on(SOCKET_EVENTS.ADMIN_EXECUTION_UPDATE, handleExecutionUpdate);

    return () => {
      socket.off(SOCKET_EVENTS.ADMIN_EXECUTION_UPDATE, handleExecutionUpdate);
    };
  }, [queryClient, socket]);

  const executions = data?.data ?? [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
          <p className="text-sm text-gray-500 mt-1">{t('routeExecutionHistory')}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">{t('allStatuses')}</option>
          {['PENDING', 'ASSIGNED', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'].map(
            (s) => (
              <option key={s} value={s}>
                {getExecutionStatusLabel(s, locale)}
              </option>
            )
          )}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3 text-left">{t('routeColumn')}</th>
                <th className="px-5 py-3 text-left">{t('driverColumn')}</th>
                <th className="px-5 py-3 text-left">{t('dateColumn')}</th>
                <th className="px-5 py-3 text-left">{t('scheduledColumn')}</th>
                <th className="px-5 py-3 text-left">{t('statusColumn')}</th>
                <th className="px-5 py-3 text-left">{t('delayColumn')}</th>
                <th className="px-5 py-3 text-left">{t('actionsColumn')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading && (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-gray-400">
                    {t('loading')}
                  </td>
                </tr>
              )}
              {!isLoading && executions.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-gray-400">
                    {t('noExecutions')}
                  </td>
                </tr>
              )}
              {executions.map((exec: {
                _id: string;
                scheduledDate: string;
                scheduledTime: string;
                status: string;
                delayMinutes: number;
                actualStartTime?: string;
                actualEndTime?: string;
                totalDurationMinutes?: number;
                routeId: { name: string };
                driverId: { name: string };
                stops?: Array<{ status: string }>;
              }) => (
                <tr key={exec._id} className="hover:bg-gray-50">
                  <td className="px-5 py-3 font-medium text-gray-900">
                    <div>
                      <p>{exec.routeId?.name}</p>
                      <p className="mt-0.5 text-xs text-gray-400">
                        {t('stopsCount', { count: exec.stops?.length ?? 0 })}
                      </p>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-gray-600">{exec.driverId?.name}</td>
                  <td className="px-5 py-3 text-gray-600">
                    {formatDateTime(`${exec.scheduledDate}T00:00:00`, locale)}
                  </td>
                  <td className="px-5 py-3 text-gray-600">
                    <div>
                      <p>{exec.scheduledTime}</p>
                      {exec.actualStartTime && (
                        <p className="mt-0.5 text-xs text-gray-400">
                          {t('started')} {formatDateTime(exec.actualStartTime, locale)}
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(exec.status)}`}>
                      {getExecutionStatusLabel(exec.status, locale)}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    {exec.delayMinutes > 0 ? (
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${getDelayColor(exec.delayMinutes)}`}>
                        {getDelayLabel(exec.delayMinutes, locale)}
                      </span>
                    ) : (
                      <span className="text-green-600 text-xs">{t('onTime')}</span>
                    )}
                    {exec.totalDurationMinutes !== undefined && (
                      <p className="mt-1 text-xs text-gray-400">{t('totalDuration', { minutes: exec.totalDurationMinutes })}</p>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <Link
                      href={`/executions/${exec._id}`}
                      className="text-blue-600 hover:underline text-xs"
                    >
                      {t('viewDetails')} →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
