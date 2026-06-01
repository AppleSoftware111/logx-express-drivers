'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Map, AdvancedMarker, Pin, Polyline } from '@vis.gl/react-google-maps';
import { useLocale, useTranslations } from 'next-intl';

import {
  getExecutionStatusLabel,
  getStopStatusLabel,
  type SupportedLocale,
} from '@logx/i18n';
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
  actualStartTime?: string;
  totalDurationMinutes?: number;
  routeId: { _id?: string; name: string };
  contractId?: { slaMinutes?: number; clientId?: { name?: string } };
  driverId: {
    _id: string;
    name: string;
    isOnline: boolean;
    phone?: string;
    currentLocation?: { lat: number; lng: number; updatedAt?: string };
  };
  stops: Array<{
    _id: string;
    order: number;
    status: string;
    address: string;
    location: { lat: number; lng: number };
    plannedTime?: string;
    expectedDurationMinutes?: number;
    instructions?: string;
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
  const locale = useLocale() as SupportedLocale;
  const tExecutions = useTranslations('executions');
  const tRoutes = useTranslations('routes');
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

  useEffect(() => {
    if (!selected && executions?.length) {
      setSelected(executions[0]._id);
    }
  }, [executions, selected]);

  const selectedExecution = executions?.find((e) => e._id === selected);
  const routePath =
    selectedExecution?.stops.map((stop) => ({
      lat: stop.location.lat,
      lng: stop.location.lng,
    })) ?? [];

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Left Panel */}
      <div className="w-[380px] flex flex-col bg-white border-r border-gray-200 overflow-hidden">
        <div className="px-4 py-4 border-b border-gray-100">
          <h1 className="font-bold text-gray-900">{tRoutes('title')}</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {executions?.length ?? 0} {tRoutes('stops').toLowerCase()}
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
              <p className="text-xs text-gray-400 truncate">
                {exec.contractId?.clientId?.name ?? tExecutions('stopsCount', { count: exec.stops.length })}
              </p>
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
                  {getExecutionStatusLabel(exec.status, locale)}
                </span>
                {exec.delayMinutes > 0 && (
                  <span
                    className={`text-xs px-1.5 py-0.5 rounded font-medium ${getDelayColor(exec.delayMinutes)}`}
                  >
                    {getDelayLabel(exec.delayMinutes, locale)}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>

        {selectedExecution && (
          <div className="border-t border-gray-100 px-4 py-4 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-gray-900">{tExecutions('title')}</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  {tExecutions('driverColumn')} {selectedExecution.driverId?.name}
                  {selectedExecution.driverId?.phone
                    ? ` · ${selectedExecution.driverId.phone}`
                    : ''}
                </p>
              </div>
              <Link
                href={`/executions/${selectedExecution._id}`}
                className="text-xs font-medium text-blue-600 hover:text-blue-700"
              >
                {tExecutions('viewDetails')}
              </Link>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-lg bg-gray-50 px-3 py-2">
                <p className="text-gray-400 uppercase tracking-wide">{tExecutions('delayColumn')}</p>
                <p className="mt-1 font-medium text-gray-900">
                  {selectedExecution.delayMinutes > 0
                    ? getDelayLabel(selectedExecution.delayMinutes, locale)
                    : tExecutions('onTime')}
                </p>
              </div>
              <div className="rounded-lg bg-gray-50 px-3 py-2">
                <p className="text-gray-400 uppercase tracking-wide">SLA</p>
                <p className="mt-1 font-medium text-gray-900">
                  {selectedExecution.contractId?.slaMinutes
                    ? `${selectedExecution.contractId.slaMinutes} min`
                    : tExecutions('notSet')}
                </p>
              </div>
            </div>

            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {selectedExecution.stops.map((stop) => (
                <div key={stop._id} className="rounded-xl border border-gray-100 px-3 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-gray-400">
                        {tRoutes('stop')} {stop.order + 1}
                      </p>
                      <p className="text-sm font-medium text-gray-900">{stop.clientId?.name}</p>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${getStatusColor(stop.status)}`}>
                      {getStopStatusLabel(stop.status, locale)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">{stop.address}</p>
                  <div className="mt-2 flex items-center justify-between text-xs text-gray-600">
                    <span>{stop.plannedTime ?? selectedExecution.scheduledTime}</span>
                    <span>{stop.expectedDurationMinutes ?? 15} min</span>
                  </div>
                  {stop.instructions && (
                    <p className="mt-2 rounded-lg bg-gray-50 px-2 py-1.5 text-xs text-gray-600">
                      {stop.instructions}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
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
                title={`${stop.order + 1}. ${stop.plannedTime ?? selectedExecution.scheduledTime} · ${stop.clientId?.name} — ${stop.status}`}
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

            {routePath.length > 1 && (
              <Polyline
                path={routePath}
                strokeColor="#2563eb"
                strokeOpacity={0.65}
                strokeWeight={4}
              />
            )}
          </Map>
        </GoogleMapsProvider>
      </div>
    </div>
  );
}
