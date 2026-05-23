'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { ArrowLeft, Clock, MapPin, User } from 'lucide-react';

import { apiClient } from '@/lib/api';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function RouteDetailPage() {
  const { id } = useParams<{ id: string }>();

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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!route) return null;

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div className="flex items-center gap-4">
        <Link href="/routes" className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{route.name}</h1>
          {route.description && <p className="text-sm text-gray-500 mt-0.5">{route.description}</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Route Info */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Route Details</h2>
          <dl className="space-y-3 text-sm">
            <div className="flex items-center gap-3">
              <Clock className="w-4 h-4 text-gray-400" />
              <div>
                <dt className="text-gray-500">Scheduled Time</dt>
                <dd className="font-medium text-gray-900 font-mono">{route.scheduledTime}</dd>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <User className="w-4 h-4 text-gray-400" />
              <div>
                <dt className="text-gray-500">Default Driver</dt>
                <dd className="font-medium text-gray-900">
                  {route.defaultDriverId?.name ?? 'Not assigned'}
                </dd>
              </div>
            </div>
            <div>
              <dt className="text-gray-500 mb-1">Recurrence</dt>
              <dd className="font-medium text-gray-900">
                {route.recurrenceType === 'WEEKLY'
                  ? `Weekly: ${route.daysOfWeek.map((d: number) => DAY_LABELS[d]).join(', ')}`
                  : route.recurrenceType}
              </dd>
            </div>
            <div>
              <dt className="text-gray-500 mb-1">Status</dt>
              <dd>
                <span
                  className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                    route.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {route.isActive ? 'Active' : 'Inactive'}
                </span>
              </dd>
            </div>
          </dl>
        </div>

        {/* Schedule Preview */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Next 14 Days</h2>
          <div className="space-y-1">
            {schedule?.map((day: { date: string; willRun: boolean; hasExecution: boolean }) => (
              <div key={day.date} className="flex items-center justify-between text-sm">
                <span className={day.willRun ? 'text-gray-900' : 'text-gray-300'}>
                  {new Date(day.date + 'T00:00:00').toLocaleDateString('pt-BR', {
                    weekday: 'short',
                    day: '2-digit',
                    month: '2-digit',
                  })}
                </span>
                {day.willRun && (
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      day.hasExecution
                        ? 'bg-green-100 text-green-700'
                        : 'bg-blue-50 text-blue-600'
                    }`}
                  >
                    {day.hasExecution ? 'Scheduled' : 'Will generate'}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Stops */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">
            Stops ({route.stops.length})
          </h2>
        </div>
        <div className="divide-y divide-gray-100">
          {route.stops
            .sort((a: { order: number }, b: { order: number }) => a.order - b.order)
            .map((stop: {
              clientId: { name: string; type: string };
              order: number;
              address: string;
              type: string;
              expectedDurationMinutes: number;
            }, i: number) => (
              <div key={i} className="flex items-center gap-4 px-5 py-3">
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-600">
                  {stop.order + 1}
                </div>
                <MapPin className="w-4 h-4 text-gray-400 shrink-0" />
                <div className="flex-1">
                  <p className="font-medium text-sm text-gray-900">{stop.clientId?.name}</p>
                  <p className="text-xs text-gray-400">{stop.address}</p>
                </div>
                <div className="text-right">
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                    {stop.type}
                  </span>
                  <p className="text-xs text-gray-400 mt-0.5">{stop.expectedDurationMinutes} min</p>
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
