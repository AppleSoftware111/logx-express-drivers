import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { apiClient } from '../services/api';

interface Stop {
  _id: string;
  order: number;
  status: string;
  address: string;
  clientId: { name: string };
  waitingTimeMinutes?: number;
}

interface Props {
  executionId: string;
  routeName: string;
  stops: Stop[];
  onDone: () => void;
}

export function RouteCompleteScreen({ executionId, routeName, stops, onDone }: Props) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const completeMutation = useMutation({
    mutationFn: async () => {
      await apiClient.patch(`/executions/${executionId}/status`, { status: 'COMPLETED' });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['today-routes'] });
      onDone();
    },
  });

  const completedCount = stops.filter((s) => s.status === 'COMPLETED').length;
  const skippedCount = stops.filter((s) => s.status === 'SKIPPED').length;
  const totalWaiting = stops.reduce((acc, s) => acc + (s.waitingTimeMinutes ?? 0), 0);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.checkCircle}>
          <Text style={styles.checkMark}>✓</Text>
        </View>
        <Text style={styles.title}>{t('mobile.routeSummary')}</Text>
        <Text style={styles.routeName}>{routeName}</Text>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{completedCount}</Text>
          <Text style={styles.statLabel}>{t('common.completed')}</Text>
        </View>
        <View style={[styles.statCard, styles.statCardMiddle]}>
          <Text style={[styles.statValue, styles.statWarning]}>{skippedCount}</Text>
          <Text style={styles.statLabel}>{t('mobile.skipped')}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{totalWaiting}</Text>
          <Text style={styles.statLabel}>{t('mobile.totalWait')}</Text>
        </View>
      </View>

      {/* Stop list */}
      <Text style={styles.sectionTitle}>{t('mobile.stops')}</Text>
      {stops.map((stop) => {
        const isCompleted = stop.status === 'COMPLETED';
        const isSkipped = stop.status === 'SKIPPED';
        return (
          <View key={stop._id} style={styles.stopRow}>
            <View
              style={[
                styles.stopIcon,
                isCompleted && styles.stopIconCompleted,
                isSkipped && styles.stopIconSkipped,
              ]}
            >
              <Text style={styles.stopIconText}>
                {isCompleted ? '✓' : isSkipped ? '✗' : String(stop.order + 1)}
              </Text>
            </View>
            <View style={styles.stopInfo}>
              <Text style={styles.stopClient}>{stop.clientId?.name}</Text>
              <Text style={styles.stopAddress} numberOfLines={1}>
                {stop.address}
              </Text>
            </View>
            {stop.waitingTimeMinutes !== undefined && (
              <Text style={styles.waitTime}>{stop.waitingTimeMinutes}min</Text>
            )}
          </View>
        );
      })}

      {/* Confirm complete button */}
      <TouchableOpacity
        style={[styles.completeBtn, completeMutation.isPending && styles.completeBtnLoading]}
        onPress={() => completeMutation.mutate()}
        disabled={completeMutation.isPending}
        activeOpacity={0.8}
      >
        <Text style={styles.completeBtnText}>
          {completeMutation.isPending ? t('mobile.saving') : t('mobile.finishRoute')}
        </Text>
      </TouchableOpacity>

      {completeMutation.isError && (
        <Text style={styles.errorText}>{t('mobile.completeRouteFailed')}</Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  content: {
    padding: 20,
    paddingBottom: 48,
  },
  header: {
    alignItems: 'center',
    marginBottom: 28,
  },
  checkCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#dcfce7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  checkMark: {
    fontSize: 32,
    color: '#16a34a',
    fontWeight: '700',
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 4,
  },
  routeName: {
    fontSize: 14,
    color: '#6b7280',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 28,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statCardMiddle: {
    borderWidth: 1,
    borderColor: '#fde68a',
    backgroundColor: '#fffbeb',
  },
  statValue: {
    fontSize: 28,
    fontWeight: '800',
    color: '#111827',
  },
  statWarning: {
    color: '#d97706',
  },
  statLabel: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  stopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  stopIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  stopIconCompleted: {
    backgroundColor: '#dcfce7',
  },
  stopIconSkipped: {
    backgroundColor: '#fee2e2',
  },
  stopIconText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
  },
  stopInfo: {
    flex: 1,
  },
  stopClient: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  stopAddress: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  waitTime: {
    fontSize: 12,
    color: '#6b7280',
    marginLeft: 8,
  },
  completeBtn: {
    backgroundColor: '#1e3a8a',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 28,
    shadowColor: '#1e3a8a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  completeBtnLoading: {
    opacity: 0.7,
  },
  completeBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  errorText: {
    color: '#dc2626',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 12,
  },
});
