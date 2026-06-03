import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { getStopStatusLabel, getRouteStopTypeLabel } from '@logx/i18n';

import { apiClient } from '../services/api';
import { useLocaleStore } from '../stores/localeStore';
import { useGpsTracking } from '../hooks/useGpsTracking';
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
  const queryClient = useQueryClient();
  const [view, setView] = useState<RouteDetailView>('route');
  const [selectedStopId, setSelectedStopId] = useState<string | null>(null);
  const [isTracking, setIsTracking] = useState(false);

  const { data: execution, isLoading } = useQuery({
    queryKey: ['execution', executionId],
    queryFn: async () => {
      const res = await apiClient.get(`/executions/${executionId}`);
      return res.data.data;
    },
    refetchInterval: isTracking ? 5_000 : false,
  });

  // GPS tracking
  useGpsTracking(executionId, isTracking);

  const startRoute = useMutation({
    mutationFn: async () => {
      await apiClient.patch(`/executions/${executionId}/status`, { status: 'IN_PROGRESS' });
    },
    onSuccess: () => {
      setIsTracking(true);
      void queryClient.invalidateQueries({ queryKey: ['execution', executionId] });
    },
    onError: () => Alert.alert(t('common.errorTitle'), t('mobile.startRouteFailed')),
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
      <View style={styles.header}>
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
        {execution?.stops?.map((stop: {
          _id: string;
          order: number;
          status: string;
          address: string;
          type: string;
          clientId: { name: string };
          waitingTimeMinutes?: number;
        }) => (
          <TouchableOpacity
            key={stop._id}
            style={[
              styles.stopCard,
              stop.status === 'COMPLETED' && styles.completedStop,
              stop.status === 'IN_PROGRESS' && styles.activeStop,
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
            onPress={() => startRoute.mutate()}
            disabled={startRoute.isPending}
          >
            {startRoute.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.startBtnText}>▶ {t('mobile.startRoute')}</Text>
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
    paddingTop: 50,
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
  stopStatus: { fontSize: 11, color: '#9ca3af', fontWeight: '600' },
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
});
