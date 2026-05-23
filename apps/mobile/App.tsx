import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as SecureStore from 'expo-secure-store';

import { LoginScreen } from './src/screens/LoginScreen';
import { TodayRoutesScreen } from './src/screens/TodayRoutesScreen';
import { RouteDetailScreen } from './src/screens/RouteDetailScreen';
import { RouteCompleteScreen } from './src/screens/RouteCompleteScreen';
import { useAuthStore } from './src/stores/authStore';
import { apiClient } from './src/services/api';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 30_000,
    },
  },
});

type Screen = 'login' | 'routes' | 'route-detail' | 'route-complete';

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

function AppContent() {
  const { isAuthenticated, setAuth, logout } = useAuthStore();
  const [screen, setScreen] = useState<Screen>('login');
  const [selectedExecutionId, setSelectedExecutionId] = useState<string | null>(null);
  const [completionCtx, setCompletionCtx] = useState<CompletionContext | null>(null);
  const [bootstrapped, setBootstrapped] = useState(false);

  // Bootstrap: check stored token
  useEffect(() => {
    const bootstrap = async () => {
      try {
        const token = await SecureStore.getItemAsync('accessToken');
        if (token) {
          const res = await apiClient.get('/auth/me');
          const raw = res.data.data as {
            _id?: string;
            id?: string;
            email: string;
            role: string;
            companyId?: string;
            driverId?: string;
          };
          setAuth(
            {
              id: raw.id ?? raw._id ?? '',
              email: raw.email,
              role: raw.role,
              companyId:
                typeof raw.companyId === 'object' && raw.companyId !== null
                  ? (raw.companyId as { _id: string })._id
                  : raw.companyId,
              driverId:
                typeof raw.driverId === 'object' && raw.driverId !== null
                  ? String(raw.driverId)
                  : raw.driverId,
            },
            token
          );
          setScreen('routes');
        }
      } catch {
        await SecureStore.deleteItemAsync('accessToken');
        logout();
      } finally {
        setBootstrapped(true);
      }
    };
    void bootstrap();
  }, []);

  if (!bootstrapped) return null;

  if (!isAuthenticated || screen === 'login') {
    return <LoginScreen onLogin={() => setScreen('routes')} />;
  }

  if (screen === 'route-complete' && completionCtx) {
    return (
      <RouteCompleteScreen
        executionId={completionCtx.executionId}
        routeName={completionCtx.routeName}
        stops={completionCtx.stops}
        onDone={() => {
          setCompletionCtx(null);
          setScreen('routes');
        }}
      />
    );
  }

  if (screen === 'route-detail' && selectedExecutionId) {
    return (
      <RouteDetailScreen
        executionId={selectedExecutionId}
        onBack={() => {
          setSelectedExecutionId(null);
          setScreen('routes');
        }}
        onComplete={(ctx) => {
          setCompletionCtx(ctx);
          setScreen('route-complete');
        }}
      />
    );
  }

  return (
    <TodayRoutesScreen
      onSelectExecution={(id) => {
        setSelectedExecutionId(id);
        setScreen('route-detail');
      }}
    />
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="light" />
      <AppContent />
    </QueryClientProvider>
  );
}
