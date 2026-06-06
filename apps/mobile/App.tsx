import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider, useTranslation } from 'react-i18next';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { initI18n, i18n } from './src/i18n';
import { LoginScreen } from './src/screens/LoginScreen';
import { TodayRoutesScreen } from './src/screens/TodayRoutesScreen';
import { RouteDetailScreen } from './src/screens/RouteDetailScreen';
import { RouteCompleteScreen } from './src/screens/RouteCompleteScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { useAuthStore } from './src/stores/authStore';
import { useLocaleStore } from './src/stores/localeStore';
import {
  apiClient,
  clearAuthSession,
  getStoredAuthSession,
  registerAuthFailureHandler,
} from './src/services/api';
import { useNetworkStatus } from './src/hooks/useNetworkStatus';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 30_000,
    },
  },
});

type RootStackParamList = {
  Login: undefined;
  Routes: undefined;
  RouteDetail: { executionId: string };
  RouteComplete: {
    executionId: string;
    routeName: string;
    stops: CompletionContext['stops'];
  };
  Settings: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

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
  const [bootstrapped, setBootstrapped] = useState(false);
  const [bootstrapNonce, setBootstrapNonce] = useState(0);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const { isOnline } = useNetworkStatus();

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const locale = await initI18n();
        useLocaleStore.setState({ locale });

        const session = await getStoredAuthSession();
        if (session.accessToken || session.refreshToken) {
          const res = await apiClient.get('/auth/me');
          const raw = res.data.data as {
            _id?: string;
            id?: string;
            email: string;
            role: string;
            locale?: string;
            companyId?: string;
            driverId?: string;
          };
          const latestSession = await getStoredAuthSession();

          setAuth(
            {
              id: raw.id ?? raw._id ?? '',
              email: raw.email,
              role: raw.role,
              locale: raw.locale,
              companyId:
                typeof raw.companyId === 'object' && raw.companyId !== null
                  ? (raw.companyId as { _id: string })._id
                  : raw.companyId,
              driverId:
                typeof raw.driverId === 'object' && raw.driverId !== null
                  ? String(raw.driverId)
                  : raw.driverId,
            },
            latestSession.accessToken ?? session.accessToken ?? '',
            latestSession.refreshToken ?? session.refreshToken
          );
        }
        setBootstrapError(null);
      } catch {
        await clearAuthSession();
        logout();
        if (!isOnline) {
          setBootstrapError('offline');
        } else {
          setBootstrapError('bootstrap');
        }
      } finally {
        setBootstrapped(true);
      }
    };
    void bootstrap();
  }, [bootstrapNonce, isOnline, logout, setAuth]);

  useEffect(() => {
    registerAuthFailureHandler(async () => {
      queryClient.clear();
    });

    return () => registerAuthFailureHandler(null);
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      queryClient.clear();
    }
  }, [isAuthenticated]);

  const navigatorKey = useMemo(
    () => `${isAuthenticated ? 'auth' : 'guest'}-${bootstrapNonce}`,
    [bootstrapNonce, isAuthenticated]
  );

  if (!bootstrapped) {
    return <StartupScreen />;
  }

  if (bootstrapError) {
    return (
      <BootstrapErrorScreen
        offline={bootstrapError === 'offline'}
        onRetry={() => {
          setBootstrapped(false);
          setBootstrapError(null);
          setBootstrapNonce((current) => current + 1);
        }}
      />
    );
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer key={navigatorKey}>
        <View style={styles.appRoot}>
          {!isOnline && <OfflineBanner />}
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            {!isAuthenticated ? (
              <Stack.Screen name="Login">
                {() => <LoginScreen onLogin={() => setBootstrapNonce((current) => current + 1)} />}
              </Stack.Screen>
            ) : (
              <>
                <Stack.Screen name="Routes">
                  {({ navigation }) => (
                    <TodayRoutesScreen
                      onSelectExecution={(id) => navigation.navigate('RouteDetail', { executionId: id })}
                      onOpenSettings={() => navigation.navigate('Settings')}
                    />
                  )}
                </Stack.Screen>
                <Stack.Screen name="RouteDetail">
                  {({ route, navigation }) => (
                    <RouteDetailScreen
                      executionId={route.params.executionId}
                      onBack={() => navigation.goBack()}
                      onComplete={(ctx) =>
                        navigation.navigate('RouteComplete', {
                          executionId: ctx.executionId,
                          routeName: ctx.routeName,
                          stops: ctx.stops,
                        })
                      }
                    />
                  )}
                </Stack.Screen>
                <Stack.Screen name="RouteComplete">
                  {({ route, navigation }) => (
                    <RouteCompleteScreen
                      executionId={route.params.executionId}
                      routeName={route.params.routeName}
                      stops={route.params.stops}
                      onDone={() => navigation.navigate('Routes')}
                    />
                  )}
                </Stack.Screen>
                <Stack.Screen name="Settings">
                  {({ navigation }) => <SettingsScreen onClose={() => navigation.goBack()} />}
                </Stack.Screen>
              </>
            )}
          </Stack.Navigator>
        </View>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

export default function App() {
  return (
    <AppErrorBoundary>
      <I18nextProvider i18n={i18n}>
        <QueryClientProvider client={queryClient}>
          <StatusBar style="light" />
          <AppContent />
        </QueryClientProvider>
      </I18nextProvider>
    </AppErrorBoundary>
  );
}

function StartupScreen() {
  return (
    <SafeAreaView style={styles.centeredScreen}>
      <ActivityIndicator size="large" color="#2563eb" />
      <Text style={styles.centeredTitle}>LOGX BioPoli</Text>
      <Text style={styles.centeredSubtitle}>Preparing your driver workspace…</Text>
    </SafeAreaView>
  );
}

function BootstrapErrorScreen({
  offline,
  onRetry,
}: {
  offline: boolean;
  onRetry: () => void;
}) {
  const { t } = useTranslation();

  return (
    <SafeAreaView style={styles.centeredScreen}>
      <Text style={styles.centeredTitle}>{t('common.errorTitle')}</Text>
      <Text style={styles.centeredSubtitle}>
        {offline ? t('mobile.offlineStartupMessage') : t('mobile.bootstrapFailed')}
      </Text>
      <TouchableOpacity style={styles.primaryAction} onPress={onRetry}>
        <Text style={styles.primaryActionText}>{t('common.retry')}</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

function OfflineBanner() {
  const { t } = useTranslation();

  return (
    <View style={styles.offlineBanner}>
      <Text style={styles.offlineBannerText}>{t('mobile.offlineBanner')}</Text>
    </View>
  );
}

class AppErrorBoundary extends React.Component<
  React.PropsWithChildren,
  { hasError: boolean; nonce: number }
> {
  constructor(props: React.PropsWithChildren) {
    super(props);
    this.state = { hasError: false, nonce: 0 };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  override componentDidCatch(error: Error) {
    console.error('[mobile-error-boundary]', error);
  }

  private handleRetry = () => {
    this.setState((current) => ({ hasError: false, nonce: current.nonce + 1 }));
  };

  override render() {
    if (this.state.hasError) {
      return (
        <SafeAreaView style={styles.centeredScreen}>
          <Text style={styles.centeredTitle}>Something went wrong</Text>
          <Text style={styles.centeredSubtitle}>
            The mobile app hit an unexpected error. Try again to recover.
          </Text>
          <TouchableOpacity style={styles.primaryAction} onPress={this.handleRetry}>
            <Text style={styles.primaryActionText}>Retry</Text>
          </TouchableOpacity>
        </SafeAreaView>
      );
    }

    return <React.Fragment key={this.state.nonce}>{this.props.children}</React.Fragment>;
  }
}

const styles = StyleSheet.create({
  appRoot: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  centeredScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 24,
  },
  centeredTitle: {
    marginTop: 16,
    fontSize: 24,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
  },
  centeredSubtitle: {
    marginTop: 8,
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
  primaryAction: {
    marginTop: 20,
    backgroundColor: '#2563eb',
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  primaryActionText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  offlineBanner: {
    backgroundColor: '#92400e',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  offlineBannerText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
});
