'use client';

import { useTranslations } from 'next-intl';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Map, AdvancedMarker, Pin, Polyline } from '@vis.gl/react-google-maps';

import { SOCKET_EVENTS } from '@logx/shared';

import { GoogleMapsProvider } from '@/components/maps/GoogleMapsProvider';
import { apiClient } from '@/lib/api';
import { useHasAccessToken } from '@/lib/authToken';
import { useSocket } from '@/hooks/useSocket';

export default function PortalTrackingPage() {
  const t = useTranslations('portal');
  const [livePos, setLivePos] = useState<{ lat: number; lng: number } | null>(null);
  const { socket } = useSocket();
  const hasToken = useHasAccessToken();

  const { data: executions } = useQuery({
    queryKey: ['portal-tracking-today'],
    enabled: hasToken,
    queryFn: async () => {
      const res = await apiClient.get('/executions/today');
      return res.data.data;
    },
    refetchInterval: 30_000,
  });

  const activeExecution = executions?.find(
    (e: { status: string }) => e.status === 'IN_PROGRESS'
  );

  useEffect(() => {
    if (!socket) return;

    socket.on(SOCKET_EVENTS.ADMIN_DRIVER_LOCATION, (data: { lat: number; lng: number }) => {
      setLivePos({ lat: data.lat, lng: data.lng });
    });

    return () => {
      socket.off(SOCKET_EVENTS.ADMIN_DRIVER_LOCATION);
    };
  }, [socket]);

  const mapCenter =
    livePos ??
    activeExecution?.driverId?.currentLocation ??
    { lat: -23.5505, lng: -46.6333 };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t('trackingTitle')}</h1>
        <p className="text-sm text-gray-500 mt-1">Real-time driver location for your deliveries</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <div>
            {activeExecution ? (
              <>
                <p className="font-medium text-gray-900">{activeExecution.routeId?.name}</p>
                <p className="text-xs text-gray-400">
                  Driver: {activeExecution.driverId?.name} ·{' '}
                  {activeExecution.stops?.filter((s: { status: string }) => s.status === 'COMPLETED').length}/
                  {activeExecution.stops?.length} stops completed
                </p>
              </>
            ) : (
              <p className="text-sm text-gray-500">No active route right now</p>
            )}
          </div>
          <div className={`flex items-center gap-2 text-xs ${livePos ? 'text-green-600' : 'text-gray-400'}`}>
            <div className={`w-2 h-2 rounded-full ${livePos ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`} />
            {livePos ? 'Live' : 'Offline'}
          </div>
        </div>
        <div className="h-[500px]">
          <GoogleMapsProvider className="h-full w-full">
            <Map
              center={mapCenter}
              zoom={14}
              gestureHandling="greedy"
              mapId="logx-portal-tracking"
            >
              {(livePos ?? activeExecution?.driverId?.currentLocation) && (
                <AdvancedMarker
                  position={livePos ?? activeExecution.driverId.currentLocation}
                >
                  <div className="driver-marker-pulse">
                    <Pin background="#2563eb" borderColor="#1d4ed8" glyphColor="#fff" scale={1.5} />
                  </div>
                </AdvancedMarker>
              )}

              {activeExecution?.stops?.map((stop: {
                _id: string;
                order: number;
                status: string;
                location: { lat: number; lng: number };
                clientId: { name: string };
              }) => (
                <AdvancedMarker
                  key={stop._id}
                  position={{ lat: stop.location.lat, lng: stop.location.lng }}
                  title={stop.clientId?.name}
                >
                  <Pin
                    background={stop.status === 'COMPLETED' ? '#22c55e' : '#f59e0b'}
                    borderColor="#fff"
                    glyphColor="#fff"
                  />
                </AdvancedMarker>
              ))}
            </Map>
          </GoogleMapsProvider>
        </div>
      </div>
    </div>
  );
}
