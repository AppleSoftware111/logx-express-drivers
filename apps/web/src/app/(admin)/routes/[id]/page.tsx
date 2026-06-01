'use client';

import { useParams } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { ArrowLeft, CalendarDays, Clock, Pencil, RefreshCcw, User } from 'lucide-react';

import { formatDateByLocale, getRouteStopTypeLabel, type SupportedLocale } from '@logx/i18n';
import { RouteMapPreview } from '@/components/routes/RouteMapPreview';
import { apiClient } from '@/lib/api';
import { queryClient } from '@/lib/queryClient';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_LABELS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function formatRecurrence(route: {
  recurrenceType: string;
  daysOfWeek: number[];
  dayOfMonth?: number;
  monthOfYear?: number;
}) {
  if (route.recurrenceType === 'WEEKLY' || route.recurrenceType === 'CUSTOM') {
    return route.daysOfWeek.map((day: number) => DAY_LABELS[day]).join(', ');
  }

  if (route.recurrenceType === 'MONTHLY') {
    return `Day ${route.dayOfMonth ?? '--'} of each month`;
  }

  if (route.recurrenceType === 'YEARLY') {
    return `${MONTH_LABELS[(route.monthOfYear ?? 1) - 1]} ${route.dayOfMonth ?? '--'}`;
  }

  return route.recurrenceType;
}

export default function RouteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const t = useTranslations('routes');
  const tCommon = useTranslations('common');
  const locale = useLocale() as SupportedLocale;

  const { data: route, isLoading } = useQuery({
    queryKey: ['route', id],
    queryFn: async () => {
      const res = await apiClient.get(`/routes/${id}`);
      return res.data.data;
    },
  });

  const { data: schedule } = useQuery({
    queryKey: ['route-schedule', id],
    queryFn: async () => {
      const res = await apiClient.get(`/routes/${id}/schedule-preview?days=14`);
      return res.data.data;
    },
    enabled: !!id,
  });

  const generateExecutions = useMutation({
    mutationFn: async (date: string) => {
      await apiClient.post('/executions/generate', { routeId: id, date });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['route-schedule', id] }),
        queryClient.invalidateQueries({ queryKey: ['executions'] }),
        queryClient.invalidateQueries({ queryKey: ['today-executions'] }),
      ]);
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!route) return null;

  const orderedStops = route.stops
    .slice()
    .sort((a: { order: number }, b: { order: number }) => a.order - b.order)
    .map(
      (stop: {
        clientId: { _id: string; name: string };
        order: number;
        address: string;
        type: string;
        plannedTime?: string;
        expectedDurationMinutes: number;
        instructions?: string;
        location: { lat: number; lng: number };
      }) => ({
        clientId: stop.clientId?._id ?? '',
        order: stop.order,
        address: stop.address,
        lat: String(stop.location.lat),
        lng: String(stop.location.lng),
        plannedTime: stop.plannedTime ?? route.scheduledTime,
        expectedDurationMinutes: stop.expectedDurationMinutes ?? 15,
        type: stop.type,
        instructions: stop.instructions ?? '',
      })
    );

  return (
    <div className="max-w-7xl space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/routes" className="rounded-lg p-2 transition-colors hover:bg-gray-100">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{route.name}</h1>
            <p className="mt-1 text-sm text-gray-500">
              {route.clientId?.name ?? t('notSelected')} · {orderedStops.length} {t('stops').toLowerCase()}
            </p>
            {route.description && <p className="mt-1 text-sm text-gray-500">{route.description}</p>}
          </div>
        </div>

        <Link
          href={`/routes/${id}/edit`}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
        >
          <Pencil className="h-4 w-4" />
          {t('editRoute')}
        </Link>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_420px]">
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <h2 className="mb-4 font-semibold text-gray-900">{t('title')}</h2>
              <dl className="space-y-3 text-sm">
                <div className="flex items-center gap-3">
                  <Clock className="h-4 w-4 text-gray-400" />
                  <div>
                    <dt className="text-gray-500">{t('routeStart')}</dt>
                    <dd className="font-mono font-medium text-gray-900">
                      {orderedStops[0]?.plannedTime ?? route.scheduledTime}
                    </dd>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <User className="h-4 w-4 text-gray-400" />
                  <div>
                    <dt className="text-gray-500">{t('form.driver')}</dt>
                    <dd className="font-medium text-gray-900">
                      {route.defaultDriverId?.name ?? t('unassigned')}
                    </dd>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <CalendarDays className="h-4 w-4 text-gray-400" />
                  <div>
                    <dt className="text-gray-500">{t('recurrence')}</dt>
                    <dd className="font-medium text-gray-900">{formatRecurrence(route)}</dd>
                  </div>
                </div>
                <div>
                  <dt className="mb-1 text-gray-500">{t('recurrence')}</dt>
                  <dd className="font-medium text-gray-900">
                    {route.recurrenceStartDate
                      ? formatDateByLocale(route.recurrenceStartDate, locale, {
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit',
                        })
                      : t('scheduled')}{' '}
                    {tCommon('to').toLowerCase()}{' '}
                    {route.recurrenceEndDate
                      ? formatDateByLocale(route.recurrenceEndDate, locale, {
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit',
                        })
                      : t('noRun')}
                  </dd>
                </div>
                <div>
                  <dt className="mb-1 text-gray-500">{tCommon('status')}</dt>
                  <dd>
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        route.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {route.isActive ? tCommon('active') : tCommon('inactive')}
                    </span>
                  </dd>
                </div>
              </dl>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <h2 className="mb-4 font-semibold text-gray-900">Next 14 days</h2>
              <div className="space-y-2">
                {schedule?.days?.map(
                  (day: {
                    date: string;
                    willRun: boolean;
                    hasExecution: boolean;
                    executionId?: string;
                    executionStatus?: string;
                  }) => (
                    <div key={day.date} className="flex items-center justify-between text-sm">
                      <span className={day.willRun ? 'text-gray-900' : 'text-gray-300'}>
                        {formatDateByLocale(`${day.date}T00:00:00`, locale, {
                          weekday: 'short',
                          day: '2-digit',
                          month: '2-digit',
                        })}
                      </span>
                      {day.willRun ? (
                        day.executionId ? (
                          <Link
                            href={`/executions/${day.executionId}`}
                            className="inline-flex items-center gap-2 rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700 transition hover:bg-green-200"
                          >
                            {day.executionStatus ?? t('scheduled')}
                          </Link>
                        ) : (
                          <button
                            type="button"
                            onClick={() => generateExecutions.mutate(day.date)}
                            disabled={generateExecutions.isPending}
                            className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-600 transition hover:bg-blue-100 disabled:opacity-60"
                          >
                            <RefreshCcw className="h-3 w-3" />
                            {t('generateNow')}
                          </button>
                        )
                      ) : (
                        <span className="text-xs text-gray-300">{t('noRun')}</span>
                      )}
                    </div>
                  )
                )}
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
            <div className="border-b border-gray-100 px-5 py-4">
              <h2 className="font-semibold text-gray-900">{t('stopTimetableTitle')}</h2>
              <p className="mt-1 text-sm text-gray-500">
                {t('stopTimetableSubtitle')}
              </p>
            </div>
            <div className="divide-y divide-gray-100">
              {route.stops
                .sort((a: { order: number }, b: { order: number }) => a.order - b.order)
                .map(
                  (
                    stop: {
                      clientId: { name: string; type: string };
                      order: number;
                      address: string;
                      type: string;
                      plannedTime?: string;
                      expectedDurationMinutes: number;
                      instructions?: string;
                    },
                    index: number
                  ) => (
                    <div key={index} className="grid gap-4 px-5 py-4 md:grid-cols-[48px_minmax(0,1fr)_180px]">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-600">
                        {stop.order + 1}
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-gray-900">{stop.clientId?.name}</p>
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                            {getRouteStopTypeLabel(stop.type, locale)}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-gray-500">{stop.address}</p>
                        {stop.instructions && (
                          <p className="mt-2 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">
                            {stop.instructions}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="font-mono text-lg font-semibold text-gray-900">
                          {stop.plannedTime ?? route.scheduledTime}
                        </p>
                        <p className="mt-1 text-xs text-gray-500">
                          {stop.expectedDurationMinutes} min service
                        </p>
                      </div>
                    </div>
                  )
                )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <RouteMapPreview stops={orderedStops} />

          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <h2 className="mb-4 font-semibold text-gray-900">{t('planningSummary')}</h2>
            <div className="space-y-3 text-sm text-gray-600">
              <div className="flex items-center justify-between">
                <span>{t('customer')}</span>
                <span className="font-medium text-gray-900">{route.clientId?.name ?? t('notSelected')}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>{t('stops')}</span>
                <span className="font-medium text-gray-900">{orderedStops.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>{t('routeStart')}</span>
                <span className="font-medium text-gray-900">{orderedStops[0]?.plannedTime ?? '--:--'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>{t('lastStop')}</span>
                <span className="font-medium text-gray-900">
                  {orderedStops[orderedStops.length - 1]?.plannedTime ?? '--:--'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
