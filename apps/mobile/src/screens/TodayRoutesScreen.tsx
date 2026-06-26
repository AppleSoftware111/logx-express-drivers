import React, { useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { formatDateByLocale, getExecutionStatusLabel } from '@logx/i18n';

import { apiClient } from '../services/api';
import { useLocaleStore } from '../stores/localeStore';

interface Execution {
  _id: string;
  scheduledTime: string;
  status: string;
  delayMinutes: number;
  runSeq?: number;
  runLabel?: string;
  routeId: { name: string };
  stops: Array<{ _id: string; status: string; clientId: { name: string } }>;
}

interface Props {
  onSelectExecution: (executionId: string) => void;
  onOpenSettings: () => void;
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: '#6b7280',
  ASSIGNED: '#2563eb',
  ACCEPTED: '#7c3aed',
  IN_PROGRESS: '#d97706',
  COMPLETED: '#16a34a',
  CANCELLED: '#dc2626',
};

export function TodayRoutesScreen({ onSelectExecution, onOpenSettings }: Props) {
  const { t } = useTranslation();
  const { locale } = useLocaleStore();
  const insets = useSafeAreaInsets();
  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['today-routes'],
    queryFn: async () => {
      const res = await apiClient.get<{ success: boolean; data: Execution[] }>(
        '/executions/today'
      );
      return res.data.data;
    },
    refetchInterval: 30_000,
    refetchOnReconnect: true,
    refetchOnMount: 'always',
  });

  const routeNameCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of data ?? []) {
      const name = item.routeId?.name ?? '';
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    return counts;
  }, [data]);

  const renderItem = ({ item }: { item: Execution }) => {
    const completedStops = item.stops.filter((s) => s.status === 'COMPLETED').length;
    const statusColor = STATUS_COLORS[item.status] ?? '#6b7280';
    const runSeq = item.runSeq ?? 1;
    const hasMultipleSameRoute = (routeNameCounts.get(item.routeId?.name ?? '') ?? 0) > 1;
    const runSubtitle =
      item.runLabel ??
      (runSeq > 1 || hasMultipleSameRoute
        ? t('mobile.runLabel', { run: runSeq, count: item.stops.length })
        : null);

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => onSelectExecution(item._id)}
        activeOpacity={0.7}
      >
        <View style={styles.cardHeader}>
          <View style={styles.titleBlock}>
            <Text style={styles.routeName}>{item.routeId?.name}</Text>
            {runSubtitle ? <Text style={styles.runSubtitle}>{runSubtitle}</Text> : null}
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusColor + '20', borderColor: statusColor }]}>
            <Text style={[styles.statusText, { color: statusColor }]}>
              {getExecutionStatusLabel(item.status, locale)}
            </Text>
          </View>
        </View>

        <View style={styles.cardBody}>
          <Text style={styles.scheduleText}>🕐 {item.scheduledTime}</Text>
          <Text style={styles.stopsText}>
            📍 {t('mobile.stopsProgress', { completed: completedStops, total: item.stops.length })}
          </Text>
        </View>

        {item.delayMinutes > 0 && (
          <View style={styles.delayBadge}>
            <Text style={styles.delayText}>
              ⚠️ {t('mobile.minLate', { minutes: item.delayMinutes })}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.loadingText}>{t('mobile.loadingRoutes')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>{t('mobile.todayRoutes')}</Text>
            <Text style={styles.subtitle}>
              {formatDateByLocale(new Date(), locale, {
                weekday: 'short',
                day: '2-digit',
                month: 'short',
              })}
            </Text>
          </View>
          <TouchableOpacity style={styles.settingsButton} onPress={onOpenSettings}>
            <Text style={styles.settingsButtonText}>{t('settings.title')}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {isError ? (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>{t('common.errorMessage')}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => void refetch()}>
            <Text style={styles.retryButtonText}>{t('common.retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : data?.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>{t('mobile.noRoutesToday')}</Text>
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item: Execution) => item._id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#2563eb" />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  header: {
    backgroundColor: '#1e3a8a',
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#fff',
  },
  subtitle: {
    fontSize: 13,
    color: '#93c5fd',
    marginTop: 4,
  },
  settingsButton: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.24)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  settingsButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  list: {
    padding: 16,
    gap: 12,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  titleBlock: {
    flex: 1,
    marginRight: 8,
  },
  routeName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  runSubtitle: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  cardBody: {
    flexDirection: 'row',
    gap: 16,
  },
  scheduleText: {
    fontSize: 13,
    color: '#374151',
  },
  stopsText: {
    fontSize: 13,
    color: '#374151',
  },
  delayBadge: {
    marginTop: 10,
    backgroundColor: '#fef3c7',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignSelf: 'flex-start',
  },
  delayText: {
    fontSize: 12,
    color: '#92400e',
    fontWeight: '600',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#6b7280',
    fontSize: 14,
  },
  emptyText: {
    color: '#9ca3af',
    fontSize: 16,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  retryButton: {
    marginTop: 12,
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
