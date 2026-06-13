import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useQuery } from '@tanstack/react-query';

import { apiClient } from '../services/api';
import {
  activateTrackedExecution,
  ensureTrackedExecutionRunning,
  flushQueuedGpsPayloads,
  getTrackedExecutionId,
  hasBackgroundGpsStarted,
  stopBackgroundGps,
} from '../services/gpsService';
import { flushWorkflowOutbox } from '../services/routeWorkflowService';
import { useAuthStore } from '../stores/authStore';
import { useSocketStore } from '../stores/socketStore';

type TodayExecution = {
  _id: string;
  status: string;
};

const TRACKING_STATUSES = new Set(['IN_PROGRESS']);
const TERMINAL_STATUSES = new Set(['COMPLETED', 'CANCELLED']);

export function useActiveExecutionTracking() {
  const { isAuthenticated, accessToken } = useAuthStore();
  const socket = useSocketStore((state) => state.socket);

  const { data: todayExecutions } = useQuery({
    queryKey: ['today-routes'],
    enabled: isAuthenticated && Boolean(accessToken),
    queryFn: async () => {
      const res = await apiClient.get<{ success: boolean; data: TodayExecution[] }>('/executions/today');
      return res.data.data;
    },
    refetchInterval: 30_000,
    refetchOnReconnect: true,
  });

  useEffect(() => {
    if (!isAuthenticated || !accessToken) {
      return;
    }

    const ensureTrackingState = async () => {
      const trackedExecutionId = await getTrackedExecutionId();
      const trackedExecution = trackedExecutionId
        ? todayExecutions?.find((execution) => execution._id === trackedExecutionId)
        : undefined;
      const inProgressExecution = todayExecutions?.find((execution) =>
        TRACKING_STATUSES.has(execution.status)
      );

      if (trackedExecutionId && trackedExecution && TERMINAL_STATUSES.has(trackedExecution.status)) {
        await stopBackgroundGps();
        return;
      }

      if (trackedExecutionId && Array.isArray(todayExecutions) && !trackedExecution) {
        await stopBackgroundGps();
        return;
      }

      if (!trackedExecutionId && inProgressExecution) {
        await activateTrackedExecution(inProgressExecution._id);
        return;
      }

      if (trackedExecutionId) {
        const isRunning = await hasBackgroundGpsStarted();
        if (!isRunning) {
          await ensureTrackedExecutionRunning(trackedExecutionId);
        }
      }
    };

    const flushQueue = async () => {
      await flushQueuedGpsPayloads();
      await flushWorkflowOutbox();
    };

    const handleAppStateChange = (nextState: string) => {
      if (nextState !== 'active') return;

      void ensureTrackingState();
      void flushQueue();
    };

    void ensureTrackingState();
    void flushQueue();

    socket?.on('connect', flushQueue);
    const appStateSubscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      socket?.off('connect', flushQueue);
      appStateSubscription.remove();
    };
  }, [accessToken, isAuthenticated, socket, todayExecutions]);
}
