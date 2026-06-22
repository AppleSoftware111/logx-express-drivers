import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useQuery } from '@tanstack/react-query';

import { apiClient, ensureFreshToken } from '../services/api';
import {
  activateTrackedExecution,
  ensureForegroundLocationStream,
  ensureTrackedExecutionRunning,
  flushQueuedGpsPayloads,
  getGpsTrackingMode,
  getTrackedExecutionId,
  hasBackgroundGpsStarted,
  startPresenceGps,
  stopBackgroundGps,
  stopForegroundLocationStream,
  stopPresenceGps,
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
      const tokenValid = await ensureFreshToken();
      if (!tokenValid) return;

      const trackedExecutionId = await getTrackedExecutionId();
      const trackedExecution = trackedExecutionId
        ? todayExecutions?.find((execution) => execution._id === trackedExecutionId)
        : undefined;
      const inProgressExecution = todayExecutions?.find((execution) =>
        TRACKING_STATUSES.has(execution.status)
      );

      if (trackedExecutionId && trackedExecution && TERMINAL_STATUSES.has(trackedExecution.status)) {
        await stopBackgroundGps();
        await startPresenceGps({ requestPermissions: false });
        return;
      }

      if (trackedExecutionId && Array.isArray(todayExecutions) && !trackedExecution) {
        await stopBackgroundGps();
        await startPresenceGps({ requestPermissions: false });
        return;
      }

      if (!trackedExecutionId && inProgressExecution) {
        await stopPresenceGps();
        await activateTrackedExecution(inProgressExecution._id);
        await ensureForegroundLocationStream();
        return;
      }

      if (trackedExecutionId) {
        const isRunning = await hasBackgroundGpsStarted();
        if (!isRunning) {
          await ensureTrackedExecutionRunning(trackedExecutionId, { requestPermissions: false });
        }
        await ensureForegroundLocationStream();
        return;
      }

      // No active route — ensure presence GPS is running
      const currentMode = await getGpsTrackingMode();
      if (currentMode !== 'presence') {
        await startPresenceGps({ requestPermissions: false });
      }
    };

    const flushQueue = async () => {
      await flushQueuedGpsPayloads();
      await flushWorkflowOutbox();
    };

    const handleAppStateChange = (nextState: string) => {
      if (nextState === 'active') {
        void ensureTrackingState();
        void flushQueue();
        return;
      }

      // App is backgrounded/locked: hand off to the OS foreground-service task.
      stopForegroundLocationStream();
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
