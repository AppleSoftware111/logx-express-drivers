import React from 'react';
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

import { formatDateByLocale, getExecutionStatusLabel } from '@logx/i18n';

import { apiClient } from '../services/api';
import { useLocaleStore } from '../stores/localeStore';

interface Execution {
  _id: string;
  scheduledTime: string;
  status: string;
  delayMinutes: number;
  routeId: { name: string };
  stops: Array<{ _id: string; status: string; clientId: { name: string } }>;
}

interface Props {
  onSelectExecution: (executionId: string) => void;
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: '#6b7280',
  ASSIGNED: '#2563eb',
  ACCEPTED: '#7c3aed',
  IN_PROGRESS: '#d97706',
  COMPLETED: '#16a34a',
  CANCELLED: '#dc2626',
};

export function TodayRoutesScreen({ onSelectExecution }: Props) {
  const { t } = useTranslation();
  const { locale } = useLocaleStore();
  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['today-routes'],
    queryFn: async () => {
      const res = await apiClient.get<{ success: boolean; data: Execution[] }>(
        '/executions/today'
      );
      return res.data.data;
    },
    refetchInterval: 30_000,
  });

  const renderItem = ({ item }: { item: Execution }) => {
    const completedStops = item.stops.filter((s) => s.status === 'COMPLETED').length;
    const statusColor = STATUS_COLORS[item.status] ?? '#6b7280';

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => onSelectExecution(item._id)}
        activeOpacity={0.7}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.routeName}>{item.routeId?.name}</Text>
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
      <View style={styles.header}>
        <Text style={styles.title}>{t('mobile.todayRoutes')}</Text>
        <Text style={styles.subtitle}>
          {formatDateByLocale(new Date(), locale, {
            weekday: 'short',
            day: '2-digit',
            month: 'short',
          })}
        </Text>
      </View>

      {data?.length === 0 ? (
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
    paddingTop: 56,
    paddingBottom: 20,
    paddingHorizontal: 20,
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
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  routeName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    flex: 1,
    marginRight: 8,
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
  },
});
