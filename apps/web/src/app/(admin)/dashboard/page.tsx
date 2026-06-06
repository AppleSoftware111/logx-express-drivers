'use client';

import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle, Clock, Truck, Users } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Map, AdvancedMarker, Pin, useMap } from '@vis.gl/react-google-maps';

import { SOCKET_EVENTS } from '@logx/shared';

import { GoogleMapsProvider } from '@/components/maps/GoogleMapsProvider';
import { apiClient } from '@/lib/api';
import { useHasAccessToken } from '@/lib/authToken';
import { useSocket } from '@/hooks/useSocket';
import { queryClient } from '@/lib/queryClient';
import type { SupportedLocale } from '@logx/i18n';

import { formatDateTime, getDelayColor, getDelayLabel, getStatusColor } from '@/lib/utils';

interface DashboardSummary {
  cards: {
    onlineDrivers: number;
    activeRoutes: number;
    delayedRoutes: number;
    completedToday: number;
    unreadAlerts: number;
  };
  recentAlerts: Array<{ _id: string; type: string; message: string; createdAt: string; isRead: boolean }>;
  activeExecutions: Array<{
    _id: string;
    status: string;
    delayMinutes: number;
    scheduledTime: string;
    routeId: { name: string };
    driverId: { name: string; isOnline: boolean; currentLocation?: { lat: number; lng: number } };
  }>;
}

interface LiveDriver {
  _id: string;
  name: string;
  currentLocation?: { lat: number; lng: number; updatedAt?: string };
  vehicleId?: { plate: string; type: string };
}

const DEFAULT_DASHBOARD_CENTER = { lat: -14.235, lng: -51.9253 };

function DriverMapAutoFit({
  points,
}: {
  points: Array<{ lat: number; lng: number }>;
}) {
  const map = useMap();

  useEffect(() => {
    if (!map || points.length === 0 || typeof google === 'undefined') return;

    if (points.length === 1) {
      map.setCenter(points[0]);
      map.setZoom(14);
      return;
    }

    const bounds = new google.maps.LatLngBounds();
    points.forEach((point) => bounds.extend(point));
    map.fitBounds(bounds, 72);
  }, [map, points]);

  return null;
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
        <Icon className="w-6 h-6" />
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        <p className="text-sm text-gray-500">{label}</p>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { socket } = useSocket();
  const hasToken = useHasAccessToken();
  const t = useTranslations('dashboard');
  const tExecutions = useTranslations('executions');
  const locale = useLocale() as SupportedLocale;

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: async () => {
      const res = await apiClient.get<{ success: boolean; data: DashboardSummary }>(
        '/dashboard/summary'
      );
      return res.data.data;
    },
    enabled: hasToken,
    refetchInterval: 30_000,
  });

  const { data: driversData } = useQuery({
    queryKey: ['live-drivers'],
    enabled: hasToken,
    queryFn: async () => {
      const res = await apiClient.get<{
        success: boolean;
        data: LiveDriver[];
      }>('/dashboard/live-drivers');
      return res.data.data;
    },
    refetchInterval: 10_000,
  });

  // Live driver location updates via socket
  useEffect(() => {
    if (!socket) return;

    const handler = () => {
      void queryClient.invalidateQueries({ queryKey: ['live-drivers'] });
    };

    socket.on(SOCKET_EVENTS.ADMIN_DRIVER_LOCATION, handler);
    socket.on(SOCKET_EVENTS.ADMIN_ALERT, () => {
      void queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
    });

    return () => {
      socket.off(SOCKET_EVENTS.ADMIN_DRIVER_LOCATION, handler);
    };
  }, [socket]);
  const summary = data?.cards;
  const liveDrivers = useMemo(
    () =>
      (driversData ?? []).filter(
        (driver) =>
          typeof driver.currentLocation?.lat === 'number' &&
          typeof driver.currentLocation?.lng === 'number'
      ),
    [driversData]
  );
  const mapPoints = useMemo(
    () =>
      liveDrivers.map((driver) => ({
        lat: driver.currentLocation!.lat,
        lng: driver.currentLocation!.lng,
      })),
    [liveDrivers]
  );
  const mapCenter = mapPoints[0] ?? DEFAULT_DASHBOARD_CENTER;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
        <p className="text-gray-500 text-sm mt-1">{t('subtitle')}</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 xl:grid-cols-5 gap-4">
        <SummaryCard
          icon={Truck}
          label={t('routesToday')}
          value={summary?.activeRoutes ?? 0}
          color="bg-blue-50 text-blue-600"
        />
        <SummaryCard
          icon={AlertTriangle}
          label={t('delayedRoutes')}
          value={summary?.delayedRoutes ?? 0}
          color="bg-red-50 text-red-600"
        />
        <SummaryCard
          icon={Users}
          label={t('activeDrivers')}
          value={summary?.onlineDrivers ?? 0}
          color="bg-green-50 text-green-600"
        />
        <SummaryCard
          icon={CheckCircle}
          label={t('completedToday')}
          value={summary?.completedToday ?? 0}
          color="bg-emerald-50 text-emerald-600"
        />
        <SummaryCard
          icon={Clock}
          label={t('unreadAlerts')}
          value={summary?.unreadAlerts ?? 0}
          color="bg-orange-50 text-orange-600"
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Live Map */}
        <div className="xl:col-span-2 bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">{t('liveDriverLocations')}</h2>
          </div>
          <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_280px]">
            <div className="h-[420px]">
              <GoogleMapsProvider className="h-full w-full">
                <Map
                  defaultCenter={DEFAULT_DASHBOARD_CENTER}
                  center={mapCenter}
                  defaultZoom={11}
                  mapId="logx-dashboard-map"
                  gestureHandling="greedy"
                >
                  <DriverMapAutoFit points={mapPoints} />
                  {liveDrivers.map((driver) => (
                    <AdvancedMarker
                      key={driver._id}
                      position={{
                        lat: driver.currentLocation!.lat,
                        lng: driver.currentLocation!.lng,
                      }}
                      title={`${driver.name} — ${driver.vehicleId?.plate ?? t('vehicleUnknown')}`}
                    >
                      <div className="drop-shadow-sm">
                        <Pin
                          background="#2563eb"
                          borderColor="#1d4ed8"
                          glyphColor="#fff"
                          scale={1.2}
                        />
                      </div>
                    </AdvancedMarker>
                  ))}
                </Map>
              </GoogleMapsProvider>
            </div>

            <div className="border-t border-gray-100 xl:border-l xl:border-t-0">
              <div className="px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  {t('driversOnMap', { count: liveDrivers.length })}
                </p>
              </div>
              <div className="max-h-[420px] divide-y divide-gray-100 overflow-auto">
                {liveDrivers.length === 0 ? (
                  <div className="px-4 py-6 text-sm text-gray-400">{t('noDriverLocations')}</div>
                ) : (
                  liveDrivers.map((driver) => (
                    <div key={driver._id} className="px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-gray-900">{driver.name}</p>
                          <p className="truncate text-xs text-gray-500">
                            {driver.vehicleId?.plate ?? t('vehicleUnknown')}
                          </p>
                        </div>
                        <div className="h-2.5 w-2.5 rounded-full bg-green-500" />
                      </div>
                      <p className="mt-2 font-mono text-xs text-gray-600">
                        {driver.currentLocation!.lat.toFixed(5)}, {driver.currentLocation!.lng.toFixed(5)}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Recent Alerts */}
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">{t('recentAlerts')}</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {data?.recentAlerts.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-8">{t('noAlerts')}</p>
            )}
            {data?.recentAlerts.map((alert) => (
              <div key={alert._id} className="px-5 py-3">
                <div className="flex items-start gap-3">
                  <div
                    className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${alert.isRead ? 'bg-gray-300' : 'bg-red-500'}`}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900 line-clamp-2">{alert.message}</p>
                    <p className="text-xs text-gray-400 mt-1">{formatDateTime(alert.createdAt, locale)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Active Executions Table */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">{t('activeExecutions')}</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3 text-left">{tExecutions('routeColumn')}</th>
                <th className="px-5 py-3 text-left">{tExecutions('driverColumn')}</th>
                <th className="px-5 py-3 text-left">{tExecutions('scheduledColumn')}</th>
                <th className="px-5 py-3 text-left">{tExecutions('statusColumn')}</th>
                <th className="px-5 py-3 text-left">{tExecutions('delayColumn')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data?.activeExecutions.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-gray-400">
                    {t('noActiveExecutions')}
                  </td>
                </tr>
              )}
              {data?.activeExecutions.map((exec) => (
                <tr key={exec._id} className="hover:bg-gray-50">
                  <td className="px-5 py-3 font-medium text-gray-900">{exec.routeId?.name}</td>
                  <td className="px-5 py-3 text-gray-600">
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-2 h-2 rounded-full ${exec.driverId?.isOnline ? 'bg-green-500' : 'bg-gray-300'}`}
                      />
                      {exec.driverId?.name}
                    </div>
                  </td>
                  <td className="px-5 py-3 text-gray-600">{exec.scheduledTime}</td>
                  <td className="px-5 py-3">
                    <span
                      className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(exec.status)}`}
                    >
                      {exec.status}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    {exec.delayMinutes > 0 ? (
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${getDelayColor(exec.delayMinutes)}`}
                      >
                        {getDelayLabel(exec.delayMinutes, locale)}
                      </span>
                    ) : (
                      <span className="text-green-600 text-xs">{tExecutions('onTime')}</span>
                    )}
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
