'use client';

import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { CheckCircle, Clock, Package, Truck } from 'lucide-react';
import { Map, AdvancedMarker, Pin } from '@vis.gl/react-google-maps';

import { GoogleMapsProvider } from '@/components/maps/GoogleMapsProvider';
import { apiClient } from '@/lib/api';
import { useHasAccessToken } from '@/lib/authToken';
import { getStatusColor } from '@/lib/utils';

export default function PortalDashboardPage() {
  const t = useTranslations('portal');
  const today = new Date().toISOString().slice(0, 10);
  const hasToken = useHasAccessToken();

  const { data: executions } = useQuery({
    queryKey: ['portal-executions-today', today],
    enabled: hasToken,
    queryFn: async () => {
      const res = await apiClient.get(`/executions/today`);
      return res.data.data;
    },
    refetchInterval: 30_000,
  });

  const liveDriver = executions?.find(
    (e: { status: string; driverId?: { currentLocation?: { lat: number; lng: number } } }) =>
      e.status === 'IN_PROGRESS' && e.driverId?.currentLocation
  );

  const completed = executions?.filter((e: { status: string }) => e.status === 'COMPLETED').length ?? 0;
  const inProgress = executions?.filter((e: { status: string }) => e.status === 'IN_PROGRESS').length ?? 0;
  const pending = executions?.filter((e: { status: string }) => ['PENDING', 'ASSIGNED', 'ACCEPTED'].includes(e.status)).length ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t('todayDeliveries')}</h1>
        <p className="text-sm text-gray-500 mt-1">
          {new Date().toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4">
          <div className="w-10 h-10 bg-yellow-50 rounded-xl flex items-center justify-center">
            <Clock className="w-5 h-5 text-yellow-600" />
          </div>
          <div>
            <p className="text-xl font-bold text-gray-900">{pending}</p>
            <p className="text-sm text-gray-500">Pending</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4">
          <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
            <Truck className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <p className="text-xl font-bold text-gray-900">{inProgress}</p>
            <p className="text-sm text-gray-500">In Progress</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4">
          <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center">
            <CheckCircle className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <p className="text-xl font-bold text-gray-900">{completed}</p>
            <p className="text-sm text-gray-500">Completed</p>
          </div>
        </div>
      </div>

      {liveDriver && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Driver Live Location</h2>
          </div>
          <div className="h-64">
            <GoogleMapsProvider className="h-full w-full">
              <Map
                defaultCenter={{
                  lat: liveDriver.driverId.currentLocation.lat,
                  lng: liveDriver.driverId.currentLocation.lng,
                }}
                defaultZoom={14}
                gestureHandling="greedy"
              >
                <AdvancedMarker
                  position={{
                    lat: liveDriver.driverId.currentLocation.lat,
                    lng: liveDriver.driverId.currentLocation.lng,
                  }}
                >
                  <Pin background="#2563eb" borderColor="#1d4ed8" glyphColor="#fff" scale={1.3} />
                </AdvancedMarker>
              </Map>
            </GoogleMapsProvider>
          </div>
        </div>
      )}

      {/* Today's routes list */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Route Status</h2>
        </div>
        <div className="divide-y divide-gray-100">
          {executions?.map((exec: {
            _id: string;
            scheduledTime: string;
            status: string;
            routeId: { name: string };
            driverId: { name: string };
            stops: Array<{ status: string }>;
          }) => (
            <div key={exec._id} className="px-5 py-3 flex items-center justify-between">
              <div>
                <p className="font-medium text-sm text-gray-900">{exec.routeId?.name}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Driver: {exec.driverId?.name} · {exec.scheduledTime}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-400">
                  {exec.stops?.filter((s: { status: string }) => s.status === 'COMPLETED').length}/{exec.stops?.length} stops
                </span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getStatusColor(exec.status)}`}>
                  {exec.status}
                </span>
              </div>
            </div>
          ))}
          {!executions?.length && (
            <div className="px-5 py-8 text-center text-gray-400 text-sm">
              No deliveries scheduled for today
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
