'use client';

import Link from 'next/link';
import { useState, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Map, AdvancedMarker, Pin, Polyline, useMap } from '@vis.gl/react-google-maps';
import { useLocale, useTranslations } from 'next-intl';

import {
  getExecutionStatusLabel,
  getStopStatusLabel,
  type SupportedLocale,
} from '@logx/i18n';
import { SOCKET_EVENTS } from '@logx/shared';

import { GoogleMapsProvider } from '@/components/maps/GoogleMapsProvider';
import { LiveVehicleMarker } from '@/components/maps/LiveVehicleMarker';
import { PaginationControls } from '@/components/ui/PaginationControls';
import { apiClient } from '@/lib/api';
import { useHasAccessToken } from '@/lib/authToken';
import { useSocket } from '@/hooks/useSocket';
import { getLocationFreshnessState } from '@/lib/locationFreshness';
import { formatDateTime, getDelayColor, getDelayLabel, getStatusColor } from '@/lib/utils';

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
    vehicleId?: { plate?: string; type?: string };
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
  executionId?: string;
  timestamp?: string;
  driverName?: string;
  vehiclePlate?: string;
  vehicleType?: string;
}

interface AdminExecutionUpdatePayload {
  event: string;
  executionId?: string;
  driverId?: string;
  status?: string;
  timestamp?: string;
}

function OperationsMapAutoFit({
  points,
}: {
  points: Array<{ lat: number; lng: number }>;
}) {
  const map = useMap();

  useEffect(() => {
    if (!map || points.length === 0 || typeof google === 'undefined') return;

    if (points.length === 1) {
      map.setCenter(points[0]);
      map.setZoom(13);
      return;
    }

    const bounds = new google.maps.LatLngBounds();
    points.forEach((point) => bounds.extend(point));
    map.fitBounds(bounds, 72);
  }, [map, points]);

  return null;
}

export default function OperationsPage() {
  const locale = useLocale() as SupportedLocale;
  const tExecutions = useTranslations('executions');
  const tRoutes = useTranslations('routes');
  const tDashboard = useTranslations('dashboard');
  const [selected, setSelected] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [liveLocations, setLiveLocations] = useState<Record<string, DriverLocation>>({});
  const { socket } = useSocket();
  const hasToken = useHasAccessToken();
  const queryClient = useQueryClient();
  const pageSize = 8;

  const { data: executions, isLoading } = useQuery({
    queryKey: ['today-executions'],
    enabled: hasToken,
    queryFn: async () => {
      const res = await apiClient.get<{ success: boolean; data: Execution[] }>(
        '/executions/today'
      );
      return res.data.data;
    },
    refetchInterval: 5_000,
    refetchOnReconnect: true,
  });

  useEffect(() => {
    if (!socket) return;

    const handleDriverLocation = (data: DriverLocation) => {
      setLiveLocations((prev) => ({
        ...prev,
        [data.driverId]: {
          ...prev[data.driverId],
          ...data,
        },
      }));
    };

    const handleExecutionUpdate = (payload: AdminExecutionUpdatePayload) => {
      void queryClient.invalidateQueries({ queryKey: ['today-executions'] });

      if (
        payload.event === 'DRIVER_ONLINE' ||
        payload.event === 'DRIVER_OFFLINE' ||
        payload.event === 'DRIVER_SUBSTITUTED'
      ) {
        void queryClient.invalidateQueries({ queryKey: ['today-executions'] });
      }
    };

    socket.on(SOCKET_EVENTS.ADMIN_DRIVER_LOCATION, handleDriverLocation);
    socket.on(SOCKET_EVENTS.ADMIN_EXECUTION_UPDATE, handleExecutionUpdate);

    return () => {
      socket.off(SOCKET_EVENTS.ADMIN_DRIVER_LOCATION, handleDriverLocation);
      socket.off(SOCKET_EVENTS.ADMIN_EXECUTION_UPDATE, handleExecutionUpdate);
    };
  }, [queryClient, socket]);

  useEffect(() => {
    if (!executions?.length) return;

    setLiveLocations((prev) => {
      const next: Record<string, DriverLocation> = {};

      executions.forEach((execution) => {
        const existingLocation = execution.driverId?._id ? prev[execution.driverId._id] : undefined;

        if (
          execution.driverId?._id &&
          typeof execution.driverId.currentLocation?.lat === 'number' &&
          typeof execution.driverId.currentLocation?.lng === 'number'
        ) {
          next[execution.driverId._id] = {
            driverId: execution.driverId._id,
            executionId: execution._id,
            lat: execution.driverId.currentLocation.lat,
            lng: execution.driverId.currentLocation.lng,
            timestamp: execution.driverId.currentLocation.updatedAt,
            driverName: execution.driverId.name,
            vehiclePlate: execution.driverId.vehicleId?.plate,
            vehicleType: execution.driverId.vehicleId?.type,
          };
        } else if (existingLocation) {
          next[execution.driverId._id] = existingLocation;
        }
      });

      return next;
    });
  }, [executions]);

  const totalExecutions = executions?.length ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalExecutions / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginatedExecutions = useMemo(
    () => executions?.slice((safePage - 1) * pageSize, safePage * pageSize) ?? [],
    [executions, pageSize, safePage]
  );

  useEffect(() => {
    if (page !== safePage) {
      setPage(safePage);
    }
  }, [page, safePage]);

  useEffect(() => {
    if (!paginatedExecutions.length) {
      setSelected(null);
      return;
    }

    const hasSelectedOnPage = paginatedExecutions.some((execution) => execution._id === selected);
    if (!hasSelectedOnPage) {
      setSelected(paginatedExecutions[0]._id);
    }
  }, [paginatedExecutions, selected]);

  const selectedExecution = paginatedExecutions.find((e) => e._id === selected);
  const selectedDriverLocation = selectedExecution?.driverId?._id
    ? liveLocations[selectedExecution.driverId._id]
    : undefined;
  const selectedDriverFreshness = getLocationFreshnessState(selectedDriverLocation?.timestamp);
  const allLiveLocations = useMemo(() => Object.values(liveLocations), [liveLocations]);
  const routePath = useMemo(
    () =>
      selectedExecution?.stops.map((stop) => ({
        lat: stop.location.lat,
        lng: stop.location.lng,
      })) ?? [],
    [selectedExecution?.stops]
  );
  const visiblePoints = useMemo(
    () => [
      ...allLiveLocations.map((location) => ({ lat: location.lat, lng: location.lng })),
      ...routePath,
    ],
    [allLiveLocations, routePath]
  );

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
          {paginatedExecutions.map((exec) => (
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

        <PaginationControls
          page={safePage}
          totalPages={totalPages}
          totalItems={totalExecutions}
          pageSize={pageSize}
          currentCount={paginatedExecutions.length}
          onPageChange={setPage}
          className="border-t border-gray-100"
        />

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
                {selectedExecution.driverId?.vehicleId?.plate ? (
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    {selectedExecution.driverId.vehicleId.plate}
                  </p>
                ) : null}
                {selectedDriverLocation?.timestamp ? (
                  <div className="mt-1 flex items-center gap-2 text-[11px]">
                    <span className={`h-2 w-2 rounded-full ${selectedDriverFreshness.dotClassName}`} />
                    <span className={selectedDriverFreshness.textClassName}>
                      {tDashboard(selectedDriverFreshness.labelKey)}
                    </span>
                    <span className="text-gray-400">
                      {tDashboard('lastUpdated', {
                        value: formatDateTime(selectedDriverLocation.timestamp, locale),
                      })}
                    </span>
                  </div>
                ) : null}
                {selectedDriverFreshness.labelKey === 'staleLocation' ||
                selectedDriverFreshness.labelKey === 'offlineLocation' ? (
                  <p className="mt-1 text-[11px] font-medium text-amber-600">
                    {tDashboard('signalDelayed')}
                  </p>
                ) : null}
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
            <OperationsMapAutoFit points={visiblePoints} />
            {/* All live drivers */}
            {allLiveLocations.map((loc) => {
              const freshness = getLocationFreshnessState(loc.timestamp);
              const isSelected = selectedExecution?.driverId?._id === loc.driverId;

              return (
                <AdvancedMarker
                  key={loc.driverId}
                  position={{ lat: loc.lat, lng: loc.lng }}
                  title={`${loc.driverName ?? selectedExecution?.driverId?.name ?? 'Driver'} — ${loc.vehiclePlate ?? tDashboard('vehicleUnknown')}`}
                >
                  <LiveVehicleMarker
                    vehicleType={loc.vehicleType}
                    freshness={freshness.labelKey}
                    highlighted={isSelected}
                  />
                </AdvancedMarker>
              );
            })}

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
