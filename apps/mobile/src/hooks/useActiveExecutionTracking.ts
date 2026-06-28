import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useQuery } from '@tanstack/react-query';

import { apiClient, ensureFreshToken } from '../services/api';
import {
  activateTrackedExecution,
  autoRecoverGpsUploads,
  ensureForegroundLocationStream,
  ensureTrackedExecutionRunning,
  GPS_AUTO_RECOVERY_INTERVAL_MS,
  GPS_BACKGROUND_RECOVERY_INTERVAL_MS,
  getGpsTrackingMode,
  getTrackedExecutionId,
  hasBackgroundGpsStarted,
  startPresenceGps,
  stopBackgroundGps,
  stopPresenceGps,
} from '../services/gpsService';
import { flushWorkflowOutbox } from '../services/routeWorkflowService';
import { useAuthStore } from '../stores/authStore';
import { useNetworkStatus } from './useNetworkStatus';
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
  const { isOnline } = useNetworkStatus();
  const wasOfflineRef = useRef(false);

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
      const tokenValid = await ensureFreshToken({ logoutOnFailure: false });
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
        await ensureForegroundLocationStream();
        return;
      }

      if (trackedExecutionId && Array.isArray(todayExecutions) && !trackedExecution) {
        await stopBackgroundGps();
        await startPresenceGps({ requestPermissions: false });
        await ensureForegroundLocationStream();
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

      const currentMode = await getGpsTrackingMode();
      if (currentMode !== 'presence') {
        await startPresenceGps({ requestPermissions: false });
      }
      await ensureForegroundLocationStream();
    };

    const runRecovery = async (options?: { aggressive?: boolean; background?: boolean }) => {
      await autoRecoverGpsUploads(options);
      await flushWorkflowOutbox();
    };

    const ensureBackgroundTaskRunning = async () => {
      const trackedExecutionId = await getTrackedExecutionId();
      if (!trackedExecutionId) return;

      const isRunning = await hasBackgroundGpsStarted();
      if (!isRunning) {
        await ensureTrackedExecutionRunning(trackedExecutionId, { requestPermissions: false });
      }
    };

    const handleAppStateChange = (nextState: string) => {
      if (nextState === 'active') {
        void ensureTrackingState();
        void runRecovery({ aggressive: true });
        return;
      }

      if (nextState === 'background' || nextState === 'inactive') {
        void (async () => {
          await ensureBackgroundTaskRunning();
          await runRecovery({ background: true });
          await ensureForegroundLocationStream();
        })();
      }
    };

    const onSocketConnect = () => {
      void runRecovery({ aggressive: true });
    };

    void ensureTrackingState();
    void runRecovery();

    socket?.on('connect', onSocketConnect);

    const appStateSubscription = AppState.addEventListener('change', handleAppStateChange);
    const activeRecoveryInterval = setInterval(() => {
      if (AppState.currentState === 'active') {
        void runRecovery();
      }
    }, GPS_AUTO_RECOVERY_INTERVAL_MS);
    const backgroundRecoveryInterval = setInterval(() => {
      if (AppState.currentState !== 'active') {
        void ensureBackgroundTaskRunning();
        void runRecovery({ background: true });
      }
    }, GPS_BACKGROUND_RECOVERY_INTERVAL_MS);

    return () => {
      socket?.off('connect', onSocketConnect);
      appStateSubscription.remove();
      clearInterval(activeRecoveryInterval);
      clearInterval(backgroundRecoveryInterval);
    };
  }, [accessToken, isAuthenticated, socket, todayExecutions]);

  useEffect(() => {
    if (!isAuthenticated || !accessToken) {
      return;
    }

    if (!isOnline) {
      wasOfflineRef.current = true;
      return;
    }

    if (wasOfflineRef.current) {
      wasOfflineRef.current = false;
      void autoRecoverGpsUploads({ aggressive: true });
      void flushWorkflowOutbox();
    }
  }, [accessToken, isAuthenticated, isOnline]);
}
