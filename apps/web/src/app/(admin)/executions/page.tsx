'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';

import { apiClient } from '@/lib/api';
import { formatDateTime, getDelayColor, getDelayLabel, getStatusColor } from '@/lib/utils';

export default function ExecutionsPage() {
  const t = useTranslations('executions');
  const locale = useLocale();
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [status, setStatus] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['executions', date, status],
    queryFn: async () => {
      const params = new URLSearchParams({ date });
      if (status) params.set('status', status);
      const res = await apiClient.get(`/executions?${params.toString()}`);
      return res.data;
    },
  });

  const executions = data?.data ?? [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
          <p className="text-sm text-gray-500 mt-1">Route execution history and live status</p>
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
          <option value="">All statuses</option>
          {['PENDING', 'ASSIGNED', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'].map(
            (s) => (
              <option key={s} value={s}>
                {s}
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
                <th className="px-5 py-3 text-left">Route</th>
                <th className="px-5 py-3 text-left">Driver</th>
                <th className="px-5 py-3 text-left">Date</th>
                <th className="px-5 py-3 text-left">Scheduled</th>
                <th className="px-5 py-3 text-left">Status</th>
                <th className="px-5 py-3 text-left">Delay</th>
                <th className="px-5 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading && (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-gray-400">
                    Loading…
                  </td>
                </tr>
              )}
              {!isLoading && executions.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-gray-400">
                    No executions found
                  </td>
                </tr>
              )}
              {executions.map((exec: {
                _id: string;
                scheduledDate: string;
                scheduledTime: string;
                status: string;
                delayMinutes: number;
                routeId: { name: string };
                driverId: { name: string };
              }) => (
                <tr key={exec._id} className="hover:bg-gray-50">
                  <td className="px-5 py-3 font-medium text-gray-900">{exec.routeId?.name}</td>
                  <td className="px-5 py-3 text-gray-600">{exec.driverId?.name}</td>
                  <td className="px-5 py-3 text-gray-600">
                    {new Date(exec.scheduledDate).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-5 py-3 text-gray-600">{exec.scheduledTime}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(exec.status)}`}>
                      {exec.status}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    {exec.delayMinutes > 0 ? (
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${getDelayColor(exec.delayMinutes)}`}>
                        {getDelayLabel(exec.delayMinutes)}
                      </span>
                    ) : (
                      <span className="text-green-600 text-xs">On time</span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <Link
                      href={`/executions/${exec._id}`}
                      className="text-blue-600 hover:underline text-xs"
                    >
                      View details →
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
