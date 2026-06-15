import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  getStopStatusLabel,
  getRouteStopTypeLabel,
  resolveApiErrorMessage,
} from '@logx/i18n';

import { apiClient } from '../services/api';
import { useLocaleStore } from '../stores/localeStore';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import {
  ensureGpsReadyForRouteStart,
  getTrackedExecutionId,
  stopBackgroundGps,
} from '../services/gpsService';
import { submitOrQueueWorkflowEvent } from '../services/routeWorkflowService';
import { StopDetailScreen } from './StopDetailScreen';
import { PODCaptureScreen } from './PODCaptureScreen';

interface CompletionContext {
  executionId: string;
  routeName: string;
  stops: Array<{
    _id: string;
    order: number;
    status: string;
    address: string;
    clientId: { name: string };
    waitingTimeMinutes?: number;
  }>;
}

interface Props {
  executionId: string;
  onBack: () => void;
  onComplete?: (ctx: CompletionContext) => void;
}

type RouteDetailView = 'route' | 'stop' | 'pod';

export function RouteDetailScreen({ executionId, onBack, onComplete }: Props) {
  const { t } = useTranslation();
  const { locale } = useLocaleStore();
  const { isOnline } = useNetworkStatus();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [view, setView] = useState<RouteDetailView>('route');
  const [selectedStopId, setSelectedStopId] = useState<string | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [gpsWarning, setGpsWarning] = useState<string | null>(null);

  const { data: execution, isLoading, isError, refetch } = useQuery({
    queryKey: ['execution', executionId],
    queryFn: async () => {
      const res = await apiClient.get(`/executions/${executionId}`);
      return res.data.data;
    },
    refetchInterval: (query) => {
      const currentExecution = query.state.data as { status?: string } | undefined;
      if (!currentExecution?.status) return 15_000;
      if (['COMPLETED', 'CANCELLED'].includes(currentExecution.status)) return false;
      return isTracking ? 5_000 : 15_000;
    },
    refetchOnReconnect: true,
  });

  const { data: alerts } = useQuery({
    queryKey: ['execution-alerts', executionId],
    queryFn: async () => {
      const res = await apiClient.get(`/executions/${executionId}/alerts`);
      return res.data.data as Array<{ _id: string; message: string }>;
    },
    enabled: Boolean(executionId),
    staleTime: 15_000,
    refetchInterval: 15_000,
    refetchOnReconnect: true,
  });

  useEffect(() => {
    void (async () => {
      const trackedExecutionId = await getTrackedExecutionId();
      if (trackedExecutionId === executionId) {
        setIsTracking(true);
      }
    })();
  }, [executionId]);

  useEffect(() => {
    if (execution?.status === 'IN_PROGRESS') {
      setIsTracking(true);
    }

    if (['COMPLETED', 'CANCELLED'].includes(execution?.status ?? '')) {
      setIsTracking(false);
      void stopBackgroundGps();
    }
  }, [execution?.status]);

  const receiveRoute = useMutation({
    mutationFn: async () => {
      const readiness = await ensureGpsReadyForRouteStart();
      if (!readiness.ready) {
        if (!readiness.notificationGranted) {
          throw new Error('notifications_not_ready');
        }
        throw new Error('gps_not_ready');
      }
      return submitOrQueueWorkflowEvent({
        action: 'ROUTE_RECEIVED',
        executionId,
      });
    },
    onSuccess: (result) => {
      setGpsWarning(null);
      void queryClient.invalidateQueries({ queryKey: ['execution', executionId] });
      void queryClient.invalidateQueries({ queryKey: ['today-routes'] });
      if (result === 'queued') {
        Alert.alert(t('common.successSaved'), t('mobile.actionQueuedForSync'));
      }
    },
    onError: (err) => {
      if (err instanceof Error && err.message === 'notifications_not_ready') {
        Alert.alert(
          t('common.errorTitle'),
          t('mobile.notificationRequiredForTracking'),
          [
            { text: t('common.cancel'), style: 'cancel' },
            {
              text: t('mobile.openSystemSettings'),
              onPress: () => {
                void Linking.openSettings();
              },
            },
          ]
        );
        return;
      }
      if (err instanceof Error && err.message === 'gps_not_ready') {
        Alert.alert(t('common.errorTitle'), t('mobile.gpsRequiredToStart'));
        return;
      }
      const axiosErr = err as { response?: { data?: { error?: { code?: string; message?: string } } } };
      const message = axiosErr.response?.data
        ? resolveApiErrorMessage(axiosErr.response.data, locale)
        : t('mobile.startRouteFailed');
      Alert.alert(t('common.errorTitle'), message);
    },
  });

  const completeRoute = useMutation({
    mutationFn: async () => {
      // Navigate to summary screen — actual PATCH happens in RouteCompleteScreen
    },
    onSuccess: () => {
      setIsTracking(false);
      if (onComplete && execution) {
        onComplete({
          executionId,
          routeName: execution.routeId?.name ?? t('mobile.routeDetail'),
          stops: execution.stops ?? [],
        });
      } else {
        onBack();
      }
    },
    onError: () => Alert.alert(t('common.errorTitle'), t('mobile.completeRouteFailed')),
  });

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  if (isError || !execution) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{t('common.errorMessage')}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => void refetch()}>
          <Text style={styles.retryButtonText}>{t('common.retry')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const selectedStop = execution?.stops?.find((s: { _id: string }) => s._id === selectedStopId);

  if (view === 'pod' && selectedStop) {
    return (
      <PODCaptureScreen
        executionId={executionId}
        stopId={selectedStop._id}
        onSuccess={() => {
          void queryClient.invalidateQueries({ queryKey: ['execution', executionId] });
          setView('route');
        }}
        onCancel={() => setView('stop')}
      />
    );
  }

  if (view === 'stop' && selectedStop) {
    return (
      <View style={{ flex: 1 }}>
        <TouchableOpacity style={styles.backButton} onPress={() => setView('route')}>
          <Text style={styles.backButtonText}>← {t('mobile.backToRoute')}</Text>
        </TouchableOpacity>
        <StopDetailScreen
          executionId={executionId}
          stop={selectedStop}
          onOpenPOD={() => setView('pod')}
        />
      </View>
    );
  }

  const allCompleted = execution?.stops?.every(
    (s: { status: string }) => s.status === 'COMPLETED' || s.status === 'SKIPPED'
  );

  return (
    <View style={{ flex: 1 }}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.backText}>← {t('mobile.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.routeName}>{execution?.routeId?.name}</Text>
        <Text style={styles.scheduleTime}>{execution?.scheduledTime}</Text>

        {isTracking && (
          <View style={styles.liveIndicator}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>{t('mobile.gpsActive')}</Text>
          </View>
        )}
      </View>

      <ScrollView style={styles.stopList}>
        {!isOnline && (
          <View style={styles.alertCard}>
            <Text style={styles.alertTitle}>{t('mobile.offlineBanner')}</Text>
            <Text style={styles.alertMessage}>{t('mobile.offlineRouteMessage')}</Text>
          </View>
        )}
        {gpsWarning && (
          <View style={styles.warningCard}>
            <Text style={styles.warningTitle}>{t('common.errorTitle')}</Text>
            <Text style={styles.warningMessage}>{gpsWarning}</Text>
          </View>
        )}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>{t('mobile.routeOverview')}</Text>
          {execution.routeId?.description ? (
            <Text style={styles.summaryText}>{execution.routeId.description}</Text>
          ) : (
            <Text style={styles.summaryMuted}>{t('mobile.noRouteInstructions')}</Text>
          )}
          <Text style={styles.summaryMeta}>
            {t('common.status')}: {execution.status}
          </Text>
          {execution.status === 'ACCEPTED' && (
            <Text style={styles.summaryMeta}>{t('mobile.routeReceived')}</Text>
          )}
          {execution.driverId?.phone && (
            <Text style={styles.summaryMeta}>
              {t('common.phone')}: {execution.driverId.phone}
            </Text>
          )}
        </View>

        {!!alerts?.length && (
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>{t('alerts.title')}</Text>
            {alerts.slice(0, 3).map((alert) => (
              <Text key={alert._id} style={styles.summaryText}>
                • {alert.message}
              </Text>
            ))}
          </View>
        )}

        {execution?.stops?.map((stop: {
          _id: string;
          order: number;
          status: string;
          address: string;
          type: string;
          clientId: { name: string };
          waitingTimeMinutes?: number;
          instructions?: string;
        }) => (
          <TouchableOpacity
            key={stop._id}
            style={[
              styles.stopCard,
              stop.status === 'COMPLETED' && styles.completedStop,
              ['ON_THE_WAY', 'ARRIVED', 'IN_PROGRESS'].includes(stop.status) && styles.activeStop,
            ]}
            onPress={() => {
              setSelectedStopId(stop._id);
              setView('stop');
            }}
          >
            <View style={styles.stopNumber}>
              <Text style={styles.stopNumberText}>{stop.order + 1}</Text>
            </View>
            <View style={styles.stopInfo}>
              <Text style={styles.stopClient}>{stop.clientId?.name}</Text>
              <Text style={styles.stopAddress} numberOfLines={1}>{stop.address}</Text>
              <Text style={styles.stopAddress}>{getRouteStopTypeLabel(stop.type, locale)}</Text>
              {!!stop.instructions && (
                <Text style={styles.stopInstruction} numberOfLines={2}>
                  {stop.instructions}
                </Text>
              )}
              {stop.waitingTimeMinutes !== undefined && (
                <Text style={styles.waitingTime}>⏱ {stop.waitingTimeMinutes} min</Text>
              )}
            </View>
            <Text style={styles.stopStatus}>{getStopStatusLabel(stop.status, locale)}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        {execution?.status === 'PENDING' || execution?.status === 'ASSIGNED' ? (
          <TouchableOpacity
            style={styles.startBtn}
            onPress={() => receiveRoute.mutate()}
            disabled={receiveRoute.isPending}
          >
            {receiveRoute.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.startBtnText}>✓ {t('mobile.routeReceivedAction')}</Text>
            )}
          </TouchableOpacity>
        ) : allCompleted && execution?.status === 'IN_PROGRESS' ? (
          <TouchableOpacity
            style={styles.completeBtn}
            onPress={() => completeRoute.mutate()}
            disabled={completeRoute.isPending}
          >
            {completeRoute.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.startBtnText}>✅ {t('mobile.completeRoute')}</Text>
            )}
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    backgroundColor: '#1e3a8a',
    padding: 20,
  },
  backText: { color: '#93c5fd', fontSize: 14, marginBottom: 8 },
  routeName: { fontSize: 20, fontWeight: '800', color: '#fff' },
  scheduleTime: { fontSize: 13, color: '#bfdbfe', marginTop: 4 },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#22c55e' },
  liveText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  stopList: { flex: 1, backgroundColor: '#f3f4f6', padding: 12 },
  stopCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  completedStop: { opacity: 0.6 },
  activeStop: { borderLeftWidth: 3, borderLeftColor: '#f59e0b' },
  stopNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#dbeafe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopNumberText: { fontSize: 14, fontWeight: '700', color: '#1d4ed8' },
  stopInfo: { flex: 1 },
  stopClient: { fontSize: 14, fontWeight: '600', color: '#111827' },
  stopAddress: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  waitingTime: { fontSize: 11, color: '#2563eb', marginTop: 2 },
  stopInstruction: { fontSize: 11, color: '#4b5563', marginTop: 4 },
  stopStatus: { fontSize: 11, color: '#9ca3af', fontWeight: '600' },
  summaryCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  summaryTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  summaryText: { fontSize: 13, color: '#374151', marginBottom: 6 },
  summaryMuted: { fontSize: 13, color: '#9ca3af' },
  summaryMeta: { fontSize: 12, color: '#6b7280', marginTop: 4 },
  alertCard: {
    backgroundColor: '#fffbeb',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  alertTitle: { fontSize: 13, fontWeight: '700', color: '#92400e' },
  alertMessage: { fontSize: 12, color: '#92400e', marginTop: 4 },
  warningCard: {
    backgroundColor: '#fef2f2',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  warningTitle: { fontSize: 13, fontWeight: '700', color: '#b91c1c' },
  warningMessage: { fontSize: 12, color: '#b91c1c', marginTop: 4 },
  footer: {
    backgroundColor: '#fff',
    padding: 16,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  startBtn: {
    backgroundColor: '#2563eb',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  completeBtn: {
    backgroundColor: '#16a34a',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  startBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  backButton: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  backButtonText: { fontSize: 14, color: '#2563eb', fontWeight: '600' },
  errorText: {
    color: '#6b7280',
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  retryButton: {
    marginTop: 14,
    backgroundColor: '#2563eb',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
});
