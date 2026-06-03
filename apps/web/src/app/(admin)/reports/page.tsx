'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

import { apiClient } from '@/lib/api';
import { useHasAccessToken } from '@/lib/authToken';

interface DriverReport {
  driverId: string;
  driverName: string;
  totalStops: number;
  completedStops: number;
  skippedStops: number;
  completionRate: number;
  avgWaitingTimeMinutes: number;
  totalWaitingTimeMinutes: number;
  totalDelayMinutes: number;
  totalExecutions: number;
}

export default function ReportsPage() {
  const t = useTranslations('reports');
  const tCommon = useTranslations('common');
  const today = new Date();
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [startDate, setStartDate] = useState(thirtyDaysAgo.toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(today.toISOString().slice(0, 10));
  const [appliedRange, setAppliedRange] = useState({ startDate, endDate });
  const sessionReady = useHasAccessToken();

  const { data, isLoading } = useQuery({
    queryKey: ['reports-summary', appliedRange],
    enabled: sessionReady,
    queryFn: async () => {
      const res = await apiClient.get<{ success: boolean; data: DriverReport[] }>(
        `/reports/summary?startDate=${appliedRange.startDate}&endDate=${appliedRange.endDate}`
      );
      return res.data.data;
    },
  });

  const handleExportCsv = () => {
    const url = `/api/reports/csv?startDate=${appliedRange.startDate}&endDate=${appliedRange.endDate}`;
    window.open(`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'}${url}`, '_blank');
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
          <p className="text-sm text-gray-500 mt-1">{t('performanceExport')}</p>
        </div>
        <button
          onClick={handleExportCsv}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 transition-colors"
        >
          <Download className="w-4 h-4" />
          {t('exportCsv')}
        </button>
      </div>

      {/* Date range filter */}
      <div className="flex items-end gap-3 bg-white rounded-xl border border-gray-200 p-4">
        <div>
          <label className="block text-xs text-gray-500 mb-1">{t('startDate')}</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">{t('endDate')}</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="ml-auto flex items-end">
          <button
            onClick={() => setAppliedRange({ startDate, endDate })}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
          >
            {t('apply')}
          </button>
        </div>
      </div>

      {/* Chart */}
      {data && data.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-4">{t('completionRateByDriver')}</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="driverName" tick={{ fontSize: 12 }} />
              <YAxis unit="%" domain={[0, 100]} />
              <Tooltip formatter={(value, name) => [`${value}%`, name]} />
              <Legend />
              <Bar dataKey="completionRate" name={t('completionRate')} fill="#2563eb" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">{t('driverPerformance')}</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3 text-left">{t('driver')}</th>
                <th className="px-5 py-3 text-right">{t('executions')}</th>
                <th className="px-5 py-3 text-right">{t('totalStops')}</th>
                <th className="px-5 py-3 text-right">{tCommon('completed')}</th>
                <th className="px-5 py-3 text-right">{t('completionPercent')}</th>
                <th className="px-5 py-3 text-right">{t('avgWaitMinutes')}</th>
                <th className="px-5 py-3 text-right">{t('totalDelayMinutes')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading && (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-gray-400">
                    {tCommon('loading')}
                  </td>
                </tr>
              )}
              {data?.map((row) => (
                <tr key={row.driverId} className="hover:bg-gray-50">
                  <td className="px-5 py-3 font-medium text-gray-900">{row.driverName}</td>
                  <td className="px-5 py-3 text-right text-gray-600">{row.totalExecutions}</td>
                  <td className="px-5 py-3 text-right text-gray-600">{row.totalStops}</td>
                  <td className="px-5 py-3 text-right text-gray-600">{row.completedStops}</td>
                  <td className="px-5 py-3 text-right">
                    <span
                      className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                        row.completionRate >= 90
                          ? 'bg-green-100 text-green-700'
                          : row.completionRate >= 70
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {row.completionRate}%
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right text-gray-600">
                    {row.avgWaitingTimeMinutes ?? '—'}
                  </td>
                  <td className="px-5 py-3 text-right text-gray-600">{row.totalDelayMinutes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
