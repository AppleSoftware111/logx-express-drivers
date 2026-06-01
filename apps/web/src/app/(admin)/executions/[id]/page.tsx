'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Map, AdvancedMarker, Polyline, Pin } from '@vis.gl/react-google-maps';
import { AlertTriangle, Pause, Play, SkipBack } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

import {
  formatDateByLocale,
  getExecutionStatusLabel,
  getStopStatusLabel,
  type SupportedLocale,
} from '@logx/i18n';
import { GoogleMapsProvider } from '@/components/maps/GoogleMapsProvider';
import { apiClient } from '@/lib/api';
import { useHasAccessToken } from '@/lib/authToken';
import { formatDateTime, getStatusColor } from '@/lib/utils';

interface GpsPoint {
  location: { type: 'Point'; coordinates: [number, number] };
  speed?: number;
  heading?: number;
  recordedAt: string;
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
  driverId: { name: string; phone?: string };
  originalDriverId: { name: string };
  isSubstitution: boolean;
  contractId?: { slaMinutes?: number; clientId?: { name?: string } };
  stops: Array<{
    _id: string;
    order: number;
    status: string;
    address: string;
    location: { lat: number; lng: number };
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
    deliveryLocation?: { lat: number; lng: number };
  }>;
}

interface ExecutionAlert {
  _id: string;
  type: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

const REPLAY_SPEED_OPTIONS = [1, 2, 5] as const;

export default function ExecutionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const t = useTranslations('executions');
  const tCommon = useTranslations('common');
  const locale = useLocale() as SupportedLocale;
  const [replayIndex, setReplayIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [replaySpeed, setReplaySpeed] = useState<(typeof REPLAY_SPEED_OPTIONS)[number]>(1);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const hasToken = useHasAccessToken();

  const { data: execution } = useQuery({
    queryKey: ['execution', id],
    enabled: hasToken && !!id,
    queryFn: async () => {
      const res = await apiClient.get<{ success: boolean; data: ExecutionDetail }>(
        `/executions/${id}`
      );
      return res.data.data;
    },
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
  });

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

  const pathPoints =
    gpsPoints?.map((p) => ({
      lat: p.location.coordinates[1],
      lng: p.location.coordinates[0],
    })) ?? [];

  const currentMarker = gpsPoints?.[replayIndex]
    ? {
        lat: gpsPoints[replayIndex].location.coordinates[1],
        lng: gpsPoints[replayIndex].location.coordinates[0],
      }
    : null;

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
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {execution?.stops.map((stop, i) => (
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
          ))}

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
