'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Map, AdvancedMarker, Polyline, Pin, useMap } from '@vis.gl/react-google-maps';
import { AlertTriangle, Pause, Play, SkipBack } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

import {
  formatDateByLocale,
  getExecutionStatusLabel,
  getStopStatusLabel,
  type SupportedLocale,
} from '@logx/i18n';
import { SOCKET_EVENTS } from '@logx/shared';
import { GoogleMapsProvider } from '@/components/maps/GoogleMapsProvider';
import { apiClient } from '@/lib/api';
import { useHasAccessToken } from '@/lib/authToken';
import { useSocket } from '@/hooks/useSocket';
import { getLocationFreshnessState } from '@/lib/locationFreshness';
import { formatDateTime, getStatusColor } from '@/lib/utils';

interface GpsPoint {
  location: { type: 'Point'; coordinates: [number, number] };
  speed?: number;
  heading?: number;
  recordedAt: string;
}

interface LatLng {
  lat: number;
  lng: number;
}

interface ExecutionStop {
  _id: string;
  order: number;
  status: string;
  address: string;
  location: LatLng;
  plannedTime?: string;
  expectedDurationMinutes?: number;
  instructions?: string;
  clientId: { name: string; type: string };
  arrivedAt?: string;
  startedAt?: string;
  completedAt?: string;
  waitingTimeMinutes?: number;
  podPhoto?: string;
  podSignature?: string;
  receiverName?: string;
  deliveryNotes?: string;
  deliveryLocation?: LatLng;
  arrivalLocation?: LatLng;
  arrivalAddress?: string;
  arrivalDistanceMeters?: number;
  collectionAddress?: string;
  collectionDistanceMeters?: number;
}

interface ExecutionDetail {
  _id: string;
  status: string;
  scheduledDate: string;
  scheduledTime: string;
  delayMinutes: number;
  actualStartTime?: string;
  actualEndTime?: string;
  totalDurationMinutes?: number;
  routeId: { name: string; description?: string };
  driverId: {
    _id?: string;
    name: string;
    phone?: string;
    isOnline?: boolean;
    currentLocation?: { lat: number; lng: number; updatedAt?: string };
  };
  originalDriverId: { name: string };
  isSubstitution: boolean;
  contractId?: { slaMinutes?: number; clientId?: { name?: string } };
  stops: ExecutionStop[];
}

interface ExecutionAlert {
  _id: string;
  type: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

interface ExecutionAudit {
  _id: string;
  action: string;
  stopId?: string;
  occurredAt: string;
  source: string;
  gps?: { lat: number; lng: number; accuracy?: number; recordedAt?: string };
  expectedLocation?: { lat: number; lng: number };
  distanceMeters?: number;
  resolvedAddress?: string;
  notes?: string;
  receiverName?: string;
  photoKey?: string;
  signatureKey?: string;
  driverId?: { name?: string; phone?: string };
  actorUserId?: { email?: string; role?: string };
}

interface DriverLocationPayload {
  driverId: string;
  executionId?: string;
  lat: number;
  lng: number;
  timestamp?: string;
}

const REPLAY_SPEED_OPTIONS = [1, 2, 5] as const;

function formatCoordinates(location?: LatLng) {
  if (!location) return null;
  return `${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}`;
}

function formatDistanceMeters(distanceMeters?: number) {
  if (typeof distanceMeters !== 'number') return null;
  return `${Math.round(distanceMeters)} m`;
}

function getLatestStopAudit(
  audits: ExecutionAudit[] | undefined,
  stopId: string,
  action: 'STOP_ARRIVED' | 'STOP_COLLECTED'
) {
  return audits?.reduce<ExecutionAudit | undefined>((latest, audit) => {
    if (audit.stopId !== stopId || audit.action !== action) return latest;
    if (!latest) return audit;
    return new Date(audit.occurredAt).getTime() > new Date(latest.occurredAt).getTime()
      ? audit
      : latest;
  }, undefined);
}

function getStopLocationProof(
  stop: ExecutionStop,
  audits: ExecutionAudit[] | undefined,
  kind: 'arrived' | 'collected'
) {
  const audit = getLatestStopAudit(
    audits,
    stop._id,
    kind === 'arrived' ? 'STOP_ARRIVED' : 'STOP_COLLECTED'
  );

  if (kind === 'arrived') {
    return {
      occurredAt: stop.arrivedAt ?? audit?.occurredAt,
      location: stop.arrivalLocation ?? audit?.gps,
      address: stop.arrivalAddress ?? audit?.resolvedAddress,
      distanceMeters: stop.arrivalDistanceMeters ?? audit?.distanceMeters,
    };
  }

  return {
    occurredAt: stop.completedAt ?? audit?.occurredAt,
    location: stop.deliveryLocation ?? audit?.gps,
    address: stop.collectionAddress ?? audit?.resolvedAddress,
    distanceMeters: stop.collectionDistanceMeters ?? audit?.distanceMeters,
  };
}

function ExecutionMapAutoFit({
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

export default function ExecutionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const t = useTranslations('executions');
  const tCommon = useTranslations('common');
  const tDashboard = useTranslations('dashboard');
  const locale = useLocale() as SupportedLocale;
  const [replayIndex, setReplayIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [replaySpeed, setReplaySpeed] = useState<(typeof REPLAY_SPEED_OPTIONS)[number]>(1);
  const [liveMarker, setLiveMarker] = useState<{ lat: number; lng: number; timestamp?: string } | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const hasToken = useHasAccessToken();
  const queryClient = useQueryClient();
  const { socket } = useSocket();

  const { data: execution } = useQuery({
    queryKey: ['execution', id],
    enabled: hasToken && !!id,
    queryFn: async () => {
      const res = await apiClient.get<{ success: boolean; data: ExecutionDetail }>(
        `/executions/${id}`
      );
      return res.data.data;
    },
    refetchInterval: 30_000,
    refetchOnReconnect: true,
  });

  const { data: gpsPoints } = useQuery({
    queryKey: ['execution-gps', id],
    enabled: hasToken && !!id,
    queryFn: async () => {
      const res = await apiClient.get<{ success: boolean; data: GpsPoint[] }>(
        `/executions/${id}/gps-track`
      );
      return res.data.data;
    },
    refetchInterval: 30_000,
    refetchOnReconnect: true,
  });

  const { data: alerts } = useQuery({
    queryKey: ['execution-alerts', id],
    enabled: hasToken && !!id,
    queryFn: async () => {
      const res = await apiClient.get<{ success: boolean; data: ExecutionAlert[] }>(
        `/executions/${id}/alerts`
      );
      return res.data.data;
    },
    refetchInterval: 30_000,
    refetchOnReconnect: true,
  });

  const { data: audits } = useQuery({
    queryKey: ['execution-audits', id],
    enabled: hasToken && !!id,
    queryFn: async () => {
      const res = await apiClient.get<{ success: boolean; data: ExecutionAudit[] }>(
        `/executions/${id}/audits`
      );
      return res.data.data;
    },
    refetchInterval: 30_000,
    refetchOnReconnect: true,
  });

  useEffect(() => {
    if (!socket || !id) return;

    socket.emit('admin:subscribe_execution', id);

    const handleExecutionUpdate = (payload: { executionId?: string }) => {
      if (payload.executionId !== id) return;

      void queryClient.invalidateQueries({ queryKey: ['execution', id] });
      void queryClient.invalidateQueries({ queryKey: ['execution-gps', id] });
      void queryClient.invalidateQueries({ queryKey: ['execution-alerts', id] });
      void queryClient.invalidateQueries({ queryKey: ['execution-audits', id] });
    };

    const handleDriverLocation = (payload: DriverLocationPayload) => {
      if (payload.executionId !== id) return;
      setLiveMarker({
        lat: payload.lat,
        lng: payload.lng,
        timestamp: payload.timestamp,
      });
    };

    const handleAlert = (payload: { executionId?: string | { _id?: string } }) => {
      const alertExecutionId =
        typeof payload.executionId === 'object' && payload.executionId !== null
          ? payload.executionId._id
          : payload.executionId;
      if (alertExecutionId !== id) return;

      void queryClient.invalidateQueries({ queryKey: ['execution-alerts', id] });
    };

    socket.on(SOCKET_EVENTS.ADMIN_EXECUTION_UPDATE, handleExecutionUpdate);
    socket.on(SOCKET_EVENTS.ADMIN_DRIVER_LOCATION, handleDriverLocation);
    socket.on(SOCKET_EVENTS.ADMIN_ALERT, handleAlert);

    return () => {
      socket.emit('admin:unsubscribe_execution', id);
      socket.off(SOCKET_EVENTS.ADMIN_EXECUTION_UPDATE, handleExecutionUpdate);
      socket.off(SOCKET_EVENTS.ADMIN_DRIVER_LOCATION, handleDriverLocation);
      socket.off(SOCKET_EVENTS.ADMIN_ALERT, handleAlert);
    };
  }, [id, queryClient, socket]);

  useEffect(() => {
    if (
      typeof execution?.driverId?.currentLocation?.lat === 'number' &&
      typeof execution?.driverId?.currentLocation?.lng === 'number'
    ) {
      setLiveMarker({
        lat: execution.driverId.currentLocation.lat,
        lng: execution.driverId.currentLocation.lng,
        timestamp: execution.driverId.currentLocation.updatedAt,
      });
    }
  }, [execution?.driverId?.currentLocation?.lat, execution?.driverId?.currentLocation?.lng, execution?.driverId?.currentLocation?.updatedAt]);

  useEffect(() => {
    if (isPlaying && gpsPoints) {
      intervalRef.current = setInterval(() => {
        setReplayIndex((prev) => {
          if (prev >= gpsPoints.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, 200 / replaySpeed);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isPlaying, replaySpeed, gpsPoints]);

  const pathPoints = useMemo(
    () =>
      gpsPoints?.map((p) => ({
        lat: p.location.coordinates[1],
        lng: p.location.coordinates[0],
      })) ?? [],
    [gpsPoints]
  );

  const replayMarker = gpsPoints?.[replayIndex]
    ? {
        lat: gpsPoints[replayIndex].location.coordinates[1],
        lng: gpsPoints[replayIndex].location.coordinates[0],
      }
    : null;
  const latestRecordedMarker = pathPoints[pathPoints.length - 1] ?? null;
  const currentMarker = isPlaying || replayIndex > 0 ? replayMarker : liveMarker ?? latestRecordedMarker;
  const markerFreshness = getLocationFreshnessState(liveMarker?.timestamp);
  const visiblePoints = useMemo(
    () => [
      ...pathPoints,
      ...(currentMarker ? [currentMarker] : []),
      ...(execution?.stops.map((stop) => ({ lat: stop.location.lat, lng: stop.location.lng })) ?? []),
    ],
    [currentMarker, execution?.stops, pathPoints]
  );

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Left: Timeline */}
      <div className="w-96 flex flex-col bg-white border-r border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h1 className="font-bold text-gray-900 text-lg">
            {execution?.routeId?.name ?? t('title')}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {execution?.scheduledDate
              ? formatDateByLocale(execution.scheduledDate, locale, {
                  year: 'numeric',
                  month: '2-digit',
                  day: '2-digit',
                })
              : ''}{' '}
            {execution?.scheduledTime}
          </p>
          {execution?.isSubstitution && (
            <span className="mt-1 inline-block text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
              Substitution — original: {execution.originalDriverId?.name}
            </span>
          )}
          <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-lg bg-gray-50 px-3 py-2">
              <p className="text-gray-400 uppercase tracking-wide">{t('statusColumn')}</p>
              <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 font-medium ${getStatusColor(execution?.status ?? 'PENDING')}`}>
                {getExecutionStatusLabel(execution?.status ?? 'PENDING', locale)}
              </span>
            </div>
            <div className="rounded-lg bg-gray-50 px-3 py-2">
              <p className="text-gray-400 uppercase tracking-wide">{t('delayColumn')}</p>
              <p className="mt-1 font-medium text-gray-900">
                {execution?.delayMinutes ? `${execution.delayMinutes} min` : t('onTime')}
              </p>
            </div>
            <div className="rounded-lg bg-gray-50 px-3 py-2">
              <p className="text-gray-400 uppercase tracking-wide">{t('customer')}</p>
              <p className="mt-1 font-medium text-gray-900">
                {execution?.contractId?.clientId?.name ?? t('notSet')}
              </p>
            </div>
            <div className="rounded-lg bg-gray-50 px-3 py-2">
              <p className="text-gray-400 uppercase tracking-wide">{t('sla')}</p>
              <p className="mt-1 font-medium text-gray-900">
                {execution?.contractId?.slaMinutes
                  ? `${execution.contractId.slaMinutes} min`
                  : t('notSet')}
              </p>
            </div>
          </div>
          {liveMarker?.timestamp && (
            <div className="mt-3 flex items-center gap-2 text-xs">
              <span className={`h-2.5 w-2.5 rounded-full ${markerFreshness.dotClassName}`} />
              <span className={markerFreshness.textClassName}>{tDashboard(markerFreshness.labelKey)}</span>
              <span className="text-gray-400">
                {tDashboard('lastUpdated', {
                  value: formatDateTime(liveMarker.timestamp, locale),
                })}
              </span>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {execution?.stops.map((stop, i) => {
            const arrivedProof = getStopLocationProof(stop, audits, 'arrived');
            const collectedProof = getStopLocationProof(stop, audits, 'collected');
            const arrivedCoordinates = formatCoordinates(arrivedProof.location);
            const collectedCoordinates = formatCoordinates(collectedProof.location);
            const arrivedDistance = formatDistanceMeters(arrivedProof.distanceMeters);
            const collectedDistance = formatDistanceMeters(collectedProof.distanceMeters);
            const hasArrivedProof = arrivedProof.occurredAt || arrivedCoordinates || arrivedProof.address || arrivedDistance;
            const hasCollectedProof = collectedProof.occurredAt || collectedCoordinates || collectedProof.address || collectedDistance;

            return (
              <div key={stop._id} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 ${
                      stop.status === 'COMPLETED'
                        ? 'bg-green-500'
                        : stop.status === 'SKIPPED'
                          ? 'bg-gray-400'
                          : stop.status === 'IN_PROGRESS'
                            ? 'bg-yellow-500'
                            : stop.status === 'ARRIVED'
                              ? 'bg-cyan-500'
                              : 'bg-gray-200 text-gray-500'
                    }`}
                  >
                    {i + 1}
                  </div>
                  {i < execution.stops.length - 1 && (
                    <div className="w-0.5 h-8 bg-gray-200 mt-1" />
                  )}
                </div>
                <div className="flex-1 pb-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium text-sm text-gray-900">{stop.clientId?.name}</p>
                    <span className="text-xs font-mono text-gray-500">
                      {stop.plannedTime ?? execution?.scheduledTime}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">{stop.address}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {stop.expectedDurationMinutes ?? 15} min service
                  </p>
                  <p className="mt-1 text-xs font-medium text-gray-500">
                    {getStopStatusLabel(stop.status, locale)}
                  </p>

                  {stop.arrivedAt && (
                    <p className="text-xs text-gray-500 mt-1">
                      {t('arrive')}: {formatDateTime(stop.arrivedAt, locale)}
                    </p>
                  )}
                  {stop.completedAt && (
                    <p className="text-xs text-gray-500">
                      {t('complete')}: {formatDateTime(stop.completedAt, locale)}
                    </p>
                  )}
                  {(hasArrivedProof || hasCollectedProof) && (
                    <div className="mt-2 space-y-2">
                      {hasArrivedProof && (
                        <div className="rounded-lg border border-cyan-100 bg-cyan-50 px-2 py-1.5 text-[11px] text-cyan-900">
                          <p className="font-semibold">{t('arrivedLocation')}</p>
                          {arrivedProof.occurredAt && (
                            <p className="mt-1 text-cyan-800">
                              {t('arrive')}: {formatDateTime(arrivedProof.occurredAt, locale)}
                            </p>
                          )}
                          {arrivedCoordinates && (
                            <p className="mt-1 font-mono text-cyan-900">
                              {t('gpsCoordinates')}: {arrivedCoordinates}
                            </p>
                          )}
                          {arrivedProof.address && (
                            <p className="mt-1 text-cyan-800">
                              {t('capturedAddress')}: {arrivedProof.address}
                            </p>
                          )}
                          {arrivedDistance && (
                            <p className="mt-1 text-cyan-800">
                              {t('distanceToStop')}: {arrivedDistance}
                            </p>
                          )}
                        </div>
                      )}
                      {hasCollectedProof && (
                        <div className="rounded-lg border border-green-100 bg-green-50 px-2 py-1.5 text-[11px] text-green-900">
                          <p className="font-semibold">{t('collectedLocation')}</p>
                          {collectedProof.occurredAt && (
                            <p className="mt-1 text-green-800">
                              {t('complete')}: {formatDateTime(collectedProof.occurredAt, locale)}
                            </p>
                          )}
                          {collectedCoordinates && (
                            <p className="mt-1 font-mono text-green-900">
                              {t('gpsCoordinates')}: {collectedCoordinates}
                            </p>
                          )}
                          {collectedProof.address && (
                            <p className="mt-1 text-green-800">
                              {t('capturedAddress')}: {collectedProof.address}
                            </p>
                          )}
                          {collectedDistance && (
                            <p className="mt-1 text-green-800">
                              {t('distanceToStop')}: {collectedDistance}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  {stop.waitingTimeMinutes !== undefined && (
                    <p className="text-xs font-medium text-blue-600 mt-1">
                      {t('waitingTime')}: {stop.waitingTimeMinutes} min
                    </p>
                  )}
                  {stop.receiverName && (
                    <p className="text-xs text-gray-500">{tCommon('receiver')}: {stop.receiverName}</p>
                  )}
                  {stop.instructions && (
                    <p className="mt-2 rounded-lg bg-gray-50 px-2 py-1.5 text-xs text-gray-600">
                      {stop.instructions}
                    </p>
                  )}
                  {stop.deliveryNotes && (
                    <p className="mt-2 rounded-lg bg-amber-50 px-2 py-1.5 text-xs text-amber-700">
                      {stop.deliveryNotes}
                    </p>
                  )}
                  {(stop.podPhoto || stop.podSignature) && (
                    <p className="mt-2 text-xs font-medium text-green-700">
                      {t('proofOfDeliveryAttached')}
                    </p>
                  )}
                </div>
              </div>
            );
          })}

          {!!alerts?.length && (
            <div className="pt-3 border-t border-gray-100">
              <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                {t('alerts')}
              </div>
              <div className="mt-3 space-y-2">
                {alerts.map((alert) => (
                  <div key={alert._id} className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-2">
                    <p className="text-xs font-medium text-amber-800">{alert.type}</p>
                    <p className="mt-1 text-xs text-amber-700">{alert.message}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!!audits?.length && (
            <div className="pt-3 border-t border-gray-100">
              <p className="text-sm font-semibold text-gray-900">Workflow audit</p>
              <div className="mt-3 space-y-2">
                {audits.map((audit) => (
                  <div key={audit._id} className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-gray-900">
                        {audit.action.replaceAll('_', ' ')}
                      </p>
                      <span className="text-[11px] text-gray-400">
                        {formatDateTime(audit.occurredAt, locale)}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-gray-500">
                      {audit.driverId?.name ?? '-'} · {audit.source}
                    </p>
                    {audit.gps && (
                      <p className="mt-1 font-mono text-[11px] text-gray-600">
                        {audit.gps.lat.toFixed(5)}, {audit.gps.lng.toFixed(5)}
                      </p>
                    )}
                    {typeof audit.distanceMeters === 'number' && (
                      <p className="mt-1 text-[11px] text-gray-600">
                        Distance to stop: {audit.distanceMeters} m
                      </p>
                    )}
                    {audit.resolvedAddress && (
                      <p className="mt-1 text-[11px] text-gray-500">{audit.resolvedAddress}</p>
                    )}
                    {(audit.photoKey || audit.signatureKey || audit.notes) && (
                      <p className="mt-1 text-[11px] text-green-700">
                        {audit.photoKey ? 'Photo attached' : ''}
                        {audit.photoKey && audit.signatureKey ? ' · ' : ''}
                        {audit.signatureKey ? 'Signature attached' : ''}
                        {(audit.photoKey || audit.signatureKey) && audit.notes ? ' · ' : ''}
                        {audit.notes ?? ''}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right: Map + Replay */}
      <div className="flex-1 flex flex-col">
        {/* Replay Controls */}
        {gpsPoints && gpsPoints.length > 0 && (
          <div className="bg-white border-b border-gray-200 px-5 py-3 flex items-center gap-4">
            <button
              onClick={() => {
                setIsPlaying(false);
                setReplayIndex(0);
              }}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <SkipBack className="w-4 h-4" />
            </button>
            <button
              onClick={() => setIsPlaying((v) => !v)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              {isPlaying ? t('pause') : t('replayGps')}
            </button>
            <div className="flex items-center gap-1">
              {REPLAY_SPEED_OPTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => setReplaySpeed(s)}
                  className={`px-3 py-1 rounded text-xs font-medium ${
                    replaySpeed === s
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-500 hover:bg-gray-100'
                  }`}
                >
                  {s}x
                </button>
              ))}
            </div>
            <div className="flex-1">
              <input
                type="range"
                min={0}
                max={Math.max(0, (gpsPoints?.length ?? 1) - 1)}
                value={replayIndex}
                onChange={(e) => {
                  setIsPlaying(false);
                  setReplayIndex(Number(e.target.value));
                }}
                className="w-full accent-blue-600"
              />
            </div>
            <span className="text-xs text-gray-500 whitespace-nowrap">
              {gpsPoints[replayIndex]
                ? formatDateByLocale(gpsPoints[replayIndex].recordedAt, locale, {
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : ''}
            </span>
          </div>
        )}

        <div className="flex-1">
          <GoogleMapsProvider className="h-full w-full">
            <Map
              defaultCenter={{ lat: -23.5505, lng: -46.6333 }}
              defaultZoom={12}
              mapId="logx-execution-map"
              gestureHandling="greedy"
              className="w-full h-full"
            >
              <ExecutionMapAutoFit points={visiblePoints} />
              {/* GPS path polyline */}
              {pathPoints.length > 1 && (
                <Polyline
                  path={pathPoints}
                  strokeColor="#2563eb"
                  strokeOpacity={0.8}
                  strokeWeight={3}
                />
              )}

              {/* Animated replay marker */}
              {currentMarker && (
                <AdvancedMarker position={currentMarker}>
                  <div className="driver-marker-pulse">
                    <Pin background="#2563eb" borderColor="#1d4ed8" glyphColor="#fff" scale={1.4} />
                  </div>
                </AdvancedMarker>
              )}

              {/* Stop markers */}
              {execution?.stops.map((stop) => (
                <AdvancedMarker
                  key={stop._id}
                  position={{ lat: stop.location.lat, lng: stop.location.lng }}
                  title={`${stop.order + 1}. ${stop.clientId?.name}`}
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
    </div>
  );
}
