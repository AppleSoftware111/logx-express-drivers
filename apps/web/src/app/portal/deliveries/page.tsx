'use client';

import { useLocale, useTranslations } from 'next-intl';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';

import { getExecutionStatusLabel, type SupportedLocale } from '@logx/i18n';

import { apiClient } from '@/lib/api';
import { formatDateTime, getStatusColor } from '@/lib/utils';

export default function PortalDeliveriesPage() {
  const t = useTranslations('portal');
  const tCommon = useTranslations('common');
  const tExecutions = useTranslations('executions');
  const tRoutes = useTranslations('routes');
  const locale = useLocale() as SupportedLocale;
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));

  const { data, isLoading } = useQuery({
    queryKey: ['portal-deliveries', startDate, endDate],
    queryFn: async () => {
      const res = await apiClient.get(
        `/executions?startDate=${startDate}&endDate=${endDate}&limit=100`
      );
      return res.data.data;
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t('deliveryHistory')}</h1>
        <p className="text-sm text-gray-500 mt-1">{t('reviewPastDeliveries')}</p>
      </div>

      <div className="flex items-center gap-3">
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
        />
        <span className="text-gray-400">{tCommon('to').toLowerCase()}</span>
        <input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
        />
      </div>

      <div className="bg-white rounded-xl border border-gray-200">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3 text-left">{tExecutions('routeColumn')}</th>
                <th className="px-5 py-3 text-left">{tExecutions('dateColumn')}</th>
                <th className="px-5 py-3 text-left">{tExecutions('driverColumn')}</th>
                <th className="px-5 py-3 text-left">{tRoutes('stops')}</th>
                <th className="px-5 py-3 text-left">{tExecutions('statusColumn')}</th>
                <th className="px-5 py-3 text-left">{tCommon('details')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading && (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-gray-400">
                    {tExecutions('loading')}
                  </td>
                </tr>
              )}
              {data?.map((exec: {
                _id: string;
                scheduledDate: string;
                scheduledTime: string;
                status: string;
                routeId: { name: string };
                driverId: { name: string };
                stops: Array<{ status: string }>;
              }) => (
                <tr key={exec._id} className="hover:bg-gray-50">
                  <td className="px-5 py-3 font-medium text-gray-900">{exec.routeId?.name}</td>
                  <td className="px-5 py-3 text-gray-600">
                    {formatDateTime(`${exec.scheduledDate}T${exec.scheduledTime}:00`, locale)}
                  </td>
                  <td className="px-5 py-3 text-gray-600">{exec.driverId?.name}</td>
                  <td className="px-5 py-3 text-gray-600">
                    {exec.stops?.filter((s: { status: string }) => s.status === 'COMPLETED').length}/{exec.stops?.length}
                  </td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(exec.status)}`}>
                      {getExecutionStatusLabel(exec.status, locale)}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <Link href={`/portal/pod?executionId=${exec._id}`} className="text-blue-600 hover:underline text-xs">
                      {t('viewPod')} →
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
