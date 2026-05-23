'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Map, AdvancedMarker, Pin, Polyline } from '@vis.gl/react-google-maps';

import { SOCKET_EVENTS } from '@logx/shared';

import { GoogleMapsProvider } from '@/components/maps/GoogleMapsProvider';
import { apiClient } from '@/lib/api';
import { useHasAccessToken } from '@/lib/authToken';
import { useSocket } from '@/hooks/useSocket';
import { getDelayColor, getDelayLabel, getStatusColor } from '@/lib/utils';

interface Execution {
  _id: string;
  status: string;
  delayMinutes: number;
  scheduledTime: string;
  routeId: { name: string };
  driverId: {
    _id: string;
    name: string;
    isOnline: boolean;
    currentLocation?: { lat: number; lng: number };
  };
  stops: Array<{
    _id: string;
    order: number;
    status: string;
    address: string;
    location: { lat: number; lng: number };
    clientId: { name: string };
  }>;
}

interface DriverLocation {
  driverId: string;
  lat: number;
  lng: number;
  executionId: string;
}

export default function OperationsPage() {
  const [selected, setSelected] = useState<string | null>(null);
  const [liveLocations, setLiveLocations] = useState<Record<string, DriverLocation>>({});
  const { socket } = useSocket();
  const hasToken = useHasAccessToken();

  const { data: executions, isLoading } = useQuery({
    queryKey: ['today-executions'],
    enabled: hasToken,
    queryFn: async () => {
      const res = await apiClient.get<{ success: boolean; data: Execution[] }>(
        '/executions/today'
      );
      return res.data.data;
    },
    refetchInterval: 30_000,
  });

  useEffect(() => {
    if (!socket) return;

    socket.on(
      SOCKET_EVENTS.ADMIN_DRIVER_LOCATION,
      (data: DriverLocation) => {
        setLiveLocations((prev) => ({
          ...prev,
          [data.driverId]: data,
        }));
      }
    );

    return () => {
      socket.off(SOCKET_EVENTS.ADMIN_DRIVER_LOCATION);
    };
  }, [socket]);

  const selectedExecution = executions?.find((e) => e._id === selected);

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Left Panel */}
      <div className="w-80 flex flex-col bg-white border-r border-gray-200 overflow-hidden">
        <div className="px-4 py-4 border-b border-gray-100">
          <h1 className="font-bold text-gray-900">Operations Center</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {executions?.length ?? 0} routes today
          </p>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full" />
            </div>
          )}
          {executions?.map((exec) => (
            <button
              key={exec._id}
              onClick={() => setSelected(exec._id)}
              className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${
                selected === exec._id ? 'bg-blue-50 border-r-2 border-blue-600' : ''
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium text-sm text-gray-900 truncate">
                  {exec.routeId?.name}
                </span>
                <span className="text-xs text-gray-400">{exec.scheduledTime}</span>
              </div>
              <div className="flex items-center gap-2">
                <div
                  className={`w-1.5 h-1.5 rounded-full ${exec.driverId?.isOnline ? 'bg-green-500' : 'bg-gray-300'}`}
                />
                <span className="text-xs text-gray-500 truncate">{exec.driverId?.name}</span>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span
                  className={`text-xs px-1.5 py-0.5 rounded font-medium ${getStatusColor(exec.status)}`}
                >
                  {exec.status}
                </span>
                {exec.delayMinutes > 0 && (
                  <span
                    className={`text-xs px-1.5 py-0.5 rounded font-medium ${getDelayColor(exec.delayMinutes)}`}
                  >
                    {getDelayLabel(exec.delayMinutes)}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Map */}
      <div className="flex-1">
        <GoogleMapsProvider className="h-full w-full">
          <Map
            defaultCenter={{ lat: -23.5505, lng: -46.6333 }}
            defaultZoom={12}
            mapId="logx-operations-map"
            gestureHandling="greedy"
            className="w-full h-full"
          >
            {/* All live drivers */}
            {Object.values(liveLocations).map((loc) => (
              <AdvancedMarker
                key={loc.driverId}
                position={{ lat: loc.lat, lng: loc.lng }}
              >
                <Pin background="#2563eb" borderColor="#1d4ed8" glyphColor="#fff" scale={1.3} />
              </AdvancedMarker>
            ))}

            {/* Selected execution stops */}
            {selectedExecution?.stops.map((stop) => (
              <AdvancedMarker
                key={stop._id}
                position={{ lat: stop.location.lat, lng: stop.location.lng }}
                title={`${stop.order + 1}. ${stop.clientId?.name} — ${stop.status}`}
              >
                <Pin
                  background={
                    stop.status === 'COMPLETED'
                      ? '#22c55e'
                      : stop.status === 'SKIPPED'
                        ? '#9ca3af'
                        : '#f59e0b'
                  }
                  borderColor="#fff"
                  glyphColor="#fff"
                />
              </AdvancedMarker>
            ))}
          </Map>
        </GoogleMapsProvider>
      </div>
    </div>
  );
}
