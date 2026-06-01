'use client';

import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ArrowRight, Eye, Power, Pencil, Plus, Route as RouteIcon } from 'lucide-react';

import { EmptyState } from '@/components/ui/EmptyState';
import { apiClient } from '@/lib/api';
import { useHasAccessToken } from '@/lib/authToken';
import { queryClient } from '@/lib/queryClient';

interface Route {
  _id: string;
  clientId?: { name: string };
  name: string;
  scheduledTime: string;
  recurrenceType: string;
  daysOfWeek: number[];
  dayOfMonth?: number;
  monthOfYear?: number;
  recurrenceStartDate?: string;
  recurrenceEndDate?: string;
  isActive: boolean;
  isTemplate: boolean;
  defaultDriverId?: { name: string };
  stops: Array<{ _id: string; clientId: { name: string }; plannedTime?: string }>;
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_LABELS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

function formatRecurrence(route: Route) {
  if (route.recurrenceType === 'WEEKLY' || route.recurrenceType === 'CUSTOM') {
    return route.daysOfWeek.map((day) => DAY_LABELS[day]).join(', ');
  }

  if (route.recurrenceType === 'MONTHLY') {
    return `Monthly on day ${route.dayOfMonth ?? '--'}`;
  }

  if (route.recurrenceType === 'YEARLY') {
    return `${MONTH_LABELS[(route.monthOfYear ?? 1) - 1]} ${route.dayOfMonth ?? '--'}`;
  }

  return route.recurrenceType;
}

export default function RoutesPage() {
  const t = useTranslations('routes');
  const sessionReady = useHasAccessToken();
  const [isActive, setIsActive] = useState<string>('true');

  const { data: routes, isLoading } = useQuery({
    queryKey: ['routes', isActive],
    enabled: sessionReady,
    queryFn: async () => {
      const params = new URLSearchParams({ isActive });
      const res = await apiClient.get<{ success: boolean; data: Route[] }>(
        `/routes?${params.toString()}`
      );
      return res.data.data;
    },
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, isActive: active }: { id: string; isActive: boolean }) => {
      await apiClient.patch(`/routes/${id}/active`, { isActive: active });
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['routes'] }),
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage fixed routes with customer ownership, ordered stops, and recurrence rules.
          </p>
        </div>
        <Link
          href="/routes/new"
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm text-white transition-colors hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          New fixed route
        </Link>
      </div>

      <div className="flex items-center gap-3">
        <select
          value={isActive}
          onChange={(e) => setIsActive(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="true">Active routes</option>
          <option value="false">Inactive routes</option>
        </select>
        <span className="text-sm text-gray-400">{routes?.length ?? 0} routes</span>
      </div>

      <div className="bg-white rounded-xl border border-gray-200">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3 text-left">Route Name</th>
                <th className="px-5 py-3 text-left">Driver</th>
                <th className="px-5 py-3 text-left">Schedule</th>
                <th className="px-5 py-3 text-left">Recurrence</th>
                <th className="px-5 py-3 text-left">Stops</th>
                <th className="px-5 py-3 text-left">Status</th>
                <th className="px-5 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading && (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-gray-400">
                    <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                  </td>
                </tr>
              )}
              {!isLoading && routes?.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-0">
                    <EmptyState
                      Icon={RouteIcon}
                      title="No fixed routes yet"
                      description="Create a recurring route with multiple scheduled stops for each customer workflow."
                      action={(
                        <Link
                          href="/routes/new"
                          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm text-white transition-colors hover:bg-blue-700"
                        >
                          <Plus className="w-4 h-4" />
                          New fixed route
                        </Link>
                      )}
                    />
                  </td>
                </tr>
              )}
              {routes?.map((route) => (
                <tr key={route._id} className="hover:bg-gray-50">
                  <td className="px-5 py-3 font-medium text-gray-900">
                    <div>
                      <p>{route.name}</p>
                      <p className="mt-0.5 text-xs font-normal text-gray-500">
                        {route.clientId?.name ?? 'No customer linked'}
                      </p>
                    </div>
                    {route.isTemplate && (
                      <span className="ml-2 text-xs bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded">
                        Template
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-gray-600">
                    {route.defaultDriverId?.name ?? '—'}
                  </td>
                  <td className="px-5 py-3 text-gray-600 font-mono">
                    {route.stops[0]?.plannedTime ?? route.scheduledTime}
                  </td>
                  <td className="px-5 py-3 text-gray-600">
                    <div>
                      <p>{formatRecurrence(route)}</p>
                      <p className="mt-0.5 text-xs text-gray-400">
                        Starts {route.recurrenceStartDate?.slice(0, 10) ?? 'immediately'}
                      </p>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-gray-600">{route.stops.length}</td>
                  <td className="px-5 py-3">
                    <span
                      className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                        route.isActive
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {route.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/routes/${route._id}/edit`}
                        className="p-1.5 rounded text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
                        title="Edit route"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Link>
                      <Link
                        href={`/routes/${route._id}`}
                        className="p-1.5 rounded text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
                        title="View route"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </Link>
                      <button
                        type="button"
                        onClick={() =>
                          toggleActive.mutate({ id: route._id, isActive: !route.isActive })
                        }
                        disabled={toggleActive.isPending}
                        className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
                        title={route.isActive ? 'Deactivate' : 'Activate'}
                      >
                        <Power className="w-3.5 h-3.5" />
                      </button>
                      <Link
                        href={`/routes/${route._id}`}
                        className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-200"
                      >
                        Review
                        <ArrowRight className="h-3 w-3" />
                      </Link>
                    </div>
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
