import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { apiClient } from '../services/api';

interface Stop {
  _id: string;
  order: number;
  status: string;
  address: string;
  type: string;
  location: { lat: number; lng: number };
  clientId: { name: string; type: string };
  arrivedAt?: string;
  startedAt?: string;
  completedAt?: string;
  waitingTimeMinutes?: number;
}

interface Props {
  executionId: string;
  stop: Stop;
  onComplete: () => void;
  onOpenPOD: () => void;
}

export function StopDetailScreen({ executionId, stop, onComplete, onOpenPOD }: Props) {
  const queryClient = useQueryClient();

  const arrived = useMutation({
    mutationFn: async () => {
      await apiClient.post(`/executions/${executionId}/stops/${stop._id}/arrived`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['execution', executionId] });
    },
    onError: () => Alert.alert('Error', 'Could not set arrival. Please try again.'),
  });

  const startPickup = useMutation({
    mutationFn: async () => {
      await apiClient.post(`/executions/${executionId}/stops/${stop._id}/start`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['execution', executionId] });
    },
  });

  const openMaps = () => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${stop.location.lat},${stop.location.lng}`;
    void Linking.openURL(url);
  };

  const formatTime = (iso?: string) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.stopNumber}>Stop {stop.order + 1}</Text>
        <Text style={styles.clientName}>{stop.clientId?.name}</Text>
        <Text style={styles.address}>{stop.address}</Text>

        <View style={styles.typeBadge}>
          <Text style={styles.typeText}>{stop.type}</Text>
        </View>
      </View>

      {/* Timeline */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Timeline</Text>
        <View style={styles.timeline}>
          <TimelineRow label="Arrived" time={formatTime(stop.arrivedAt)} done={!!stop.arrivedAt} />
          <TimelineRow label="Started" time={formatTime(stop.startedAt)} done={!!stop.startedAt} />
          <TimelineRow label="Completed" time={formatTime(stop.completedAt)} done={!!stop.completedAt} />
        </View>
        {stop.waitingTimeMinutes !== undefined && stop.waitingTimeMinutes > 0 && (
          <View style={styles.waitingBadge}>
            <Text style={styles.waitingText}>⏱ Waiting time: {stop.waitingTimeMinutes} min</Text>
          </View>
        )}
      </View>

      {/* Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Actions</Text>

        <TouchableOpacity style={styles.actionButton} onPress={openMaps}>
          <Text style={styles.actionButtonText}>🗺 Navigate</Text>
        </TouchableOpacity>

        {stop.status === 'PENDING' && (
          <TouchableOpacity
            style={[styles.actionButton, styles.arrivedButton]}
            onPress={() => arrived.mutate()}
            disabled={arrived.isPending}
          >
            {arrived.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={[styles.actionButtonText, { color: '#fff' }]}>📍 Mark Arrived</Text>
            )}
          </TouchableOpacity>
        )}

        {stop.status === 'ARRIVED' && (
          <TouchableOpacity
            style={[styles.actionButton, styles.startButton]}
            onPress={() => startPickup.mutate()}
            disabled={startPickup.isPending}
          >
            {startPickup.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={[styles.actionButtonText, { color: '#fff' }]}>▶ Start {stop.type === 'DELIVERY' ? 'Delivery' : 'Pickup'}</Text>
            )}
          </TouchableOpacity>
        )}

        {stop.status === 'IN_PROGRESS' && (
          <TouchableOpacity
            style={[styles.actionButton, styles.completeButton]}
            onPress={onOpenPOD}
          >
            <Text style={[styles.actionButtonText, { color: '#fff' }]}>
              ✅ Complete & Capture POD
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
}

function TimelineRow({ label, time, done }: { label: string; time: string; done: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
      <View
        style={{
          width: 10,
          height: 10,
          borderRadius: 5,
          backgroundColor: done ? '#16a34a' : '#d1d5db',
        }}
      />
      <Text style={{ fontSize: 14, color: '#374151', flex: 1 }}>{label}</Text>
      <Text style={{ fontSize: 13, color: done ? '#16a34a' : '#9ca3af', fontWeight: done ? '600' : '400' }}>
        {time}
      </Text>
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
    padding: 20,
    paddingTop: 40,
  },
  stopNumber: {
    fontSize: 12,
    color: '#93c5fd',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  clientName: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
    marginTop: 4,
  },
  address: {
    fontSize: 13,
    color: '#bfdbfe',
    marginTop: 4,
  },
  typeBadge: {
    marginTop: 10,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  typeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  section: {
    backgroundColor: '#fff',
    margin: 12,
    borderRadius: 14,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  timeline: {},
  waitingBadge: {
    backgroundColor: '#dbeafe',
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
  },
  waitingText: {
    color: '#1d4ed8',
    fontSize: 13,
    fontWeight: '600',
  },
  actionButton: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  arrivedButton: {
    backgroundColor: '#0ea5e9',
    borderColor: '#0ea5e9',
  },
  startButton: {
    backgroundColor: '#f59e0b',
    borderColor: '#f59e0b',
  },
  completeButton: {
    backgroundColor: '#16a34a',
    borderColor: '#16a34a',
  },
  actionButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#374151',
  },
});
