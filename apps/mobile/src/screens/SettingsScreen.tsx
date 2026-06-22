import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Constants from 'expo-constants';
import * as Location from 'expo-location';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { formatTimeByLocale, type SupportedLocale } from '@logx/i18n';

import { apiClient, clearAuthSession, ensureFreshToken, persistStoredUser } from '../services/api';
import {
  clearGpsDiagnostics,
  getGpsTrackingMode,
  getLastGpsSendResult,
  getLastGpsSentAt,
  getNotificationPermissionState,
  getTrackedExecutionId,
  hasBackgroundGpsStarted,
  ensureTrackedExecutionRunning,
  startPresenceGps,
  requestIgnoreBatteryOptimizations,
  requestNotificationPermission,
  type GpsTrackingMode,
  type NotificationPermissionState,
} from '../services/gpsService';
import { useAuthStore } from '../stores/authStore';
import { useLocaleStore } from '../stores/localeStore';

interface Props {
  onClose: () => void;
}

type PermissionState = 'granted' | 'denied' | 'undetermined';

export function SettingsScreen({ onClose }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { locale, setLocale } = useLocaleStore();
  const { user, refreshToken, logout } = useAuthStore();
  const [isSavingLocale, setIsSavingLocale] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [foregroundPermission, setForegroundPermission] = useState<PermissionState>('undetermined');
  const [backgroundPermission, setBackgroundPermission] = useState<PermissionState>('undetermined');
  const [notificationPermission, setNotificationPermission] =
    useState<NotificationPermissionState>('undetermined');
  const [isUpdatingNotifications, setIsUpdatingNotifications] = useState(false);
  const [trackingMode, setTrackingMode] = useState<GpsTrackingMode>('off');
  const [lastGpsSentAt, setLastGpsSentAt] = useState<string | null>(null);
  const [lastGpsResult, setLastGpsResult] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const refreshPermissions = async () => {
    setIsRefreshing(true);
    try {
      await ensureTrackingServiceRunning();
      await readDiagnostics();
    } finally {
      setIsRefreshing(false);
    }
  };

  const ensureTrackingServiceRunning = async () => {
    try {
      const tokenOk = await ensureFreshToken();
      if (!tokenOk) return;

      const trackedExecutionId = await getTrackedExecutionId();
      if (trackedExecutionId) {
        const isRunning = await hasBackgroundGpsStarted();
        if (!isRunning) {
          await ensureTrackedExecutionRunning(trackedExecutionId);
        }
      } else {
        const currentMode = await getGpsTrackingMode();
        if (currentMode === 'off') {
          await startPresenceGps();
        }
      }
    } catch {
      // Restart failed — diagnostics will still show the current state below
    }
  };

  const readDiagnostics = async () => {
    const [foreground, background, notifications, mode, lastSent, lastResult] = await Promise.all([
      Location.getForegroundPermissionsAsync(),
      Location.getBackgroundPermissionsAsync(),
      getNotificationPermissionState(),
      getGpsTrackingMode(),
      getLastGpsSentAt(),
      getLastGpsSendResult(),
    ]);

    setForegroundPermission(foreground.status);
    setBackgroundPermission(background.status);
    setNotificationPermission(notifications);
    setTrackingMode(mode);
    setLastGpsSentAt(lastSent);
    setLastGpsResult(lastResult);
  };

  const lastGpsResultLabel = (() => {
    if (!lastGpsResult) return t('mobile.trackingNeverSent');
    if (lastGpsResult === 'ok') return t('mobile.trackingSendOk');
    if (lastGpsResult === 'http_401' || lastGpsResult === 'http_403') {
      return t('mobile.trackingSendAuth');
    }
    return t('mobile.trackingSendFailed', { code: lastGpsResult });
  })();

  useEffect(() => {
    void (async () => {
      await refreshPermissions();
    })();
  }, []);

  const changeLocale = async (value: SupportedLocale) => {
    setIsSavingLocale(true);
    try {
      await setLocale(value);
      await apiClient.patch('/auth/me/preferences', { locale: value });
      if (user) {
        await persistStoredUser({ ...user, locale: value });
      }
    } catch {
      Alert.alert(t('common.errorTitle'), t('mobile.languageUpdateFailed'));
    } finally {
      setIsSavingLocale(false);
    }
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await apiClient.post('/auth/logout', { refreshToken });
    } catch {
      // Ignore network/logout endpoint failures and clear the local session anyway.
    } finally {
      await clearAuthSession();
      await clearGpsDiagnostics();
      logout();
      setIsLoggingOut(false);
    }
  };

  const version = Constants.expoConfig?.version ?? '1.0.0';
  const runtimeVersion = Constants.expoConfig?.runtimeVersion ?? 'local';
  const appName = Constants.expoConfig?.name ?? t('common.appName');

  const handleNotificationPermission = async () => {
    if (notificationPermission === 'granted') {
      await Linking.openSettings();
      return;
    }

    setIsUpdatingNotifications(true);
    try {
      const result = await requestNotificationPermission();
      setNotificationPermission(result);

      if (result !== 'granted') {
        Alert.alert(
          t('common.errorTitle'),
          t('mobile.notificationRequiredForTracking'),
          [
            { text: t('common.cancel'), style: 'cancel' },
            {
              text: t('mobile.openSystemSettings'),
              onPress: () => {
                void Linking.openSettings();
              },
            },
          ]
        );
      }
    } finally {
      setIsUpdatingNotifications(false);
      await refreshPermissions();
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <TouchableOpacity onPress={onClose}>
          <Text style={styles.backText}>← {t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('settings.title')}</Text>
        <Text style={styles.subtitle}>{t('mobile.settingsSubtitle')}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>{t('settings.profile')}</Text>
        <Text style={styles.primaryValue}>{user?.email ?? '—'}</Text>
        <Text style={styles.secondaryValue}>
          {t('settings.yourRole')}: {user?.role ?? '—'}
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>{t('common.language')}</Text>
        <Text style={styles.helperText}>{t('settings.languageHint')}</Text>
        <View style={styles.languageRow}>
          {([
            { value: 'pt', label: t('common.languagePt') },
            { value: 'es', label: t('common.languageEs') },
            { value: 'en', label: t('common.languageEn') },
          ] as Array<{ value: SupportedLocale; label: string }>).map((item) => (
            <TouchableOpacity
              key={item.value}
              style={[
                styles.languageButton,
                locale === item.value && styles.languageButtonActive,
              ]}
              onPress={() => void changeLocale(item.value)}
              disabled={isSavingLocale}
            >
              <Text
                style={[
                  styles.languageButtonText,
                  locale === item.value && styles.languageButtonTextActive,
                ]}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        {isSavingLocale && <ActivityIndicator style={styles.inlineLoader} color="#2563eb" />}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>{t('mobile.permissions')}</Text>
        <PermissionRow
          label={t('mobile.foregroundLocation')}
          status={foregroundPermission}
        />
        <PermissionRow
          label={t('mobile.backgroundLocation')}
          status={backgroundPermission}
        />
        <PermissionRow
          label={t('mobile.notificationPermission')}
          status={notificationPermission}
        />
        <Text style={styles.helperText}>{t('mobile.notificationPermissionHint')}</Text>
        <TouchableOpacity
          style={[styles.settingsActionButton, isUpdatingNotifications && styles.settingsActionButtonDisabled]}
          onPress={() => void handleNotificationPermission()}
          disabled={isUpdatingNotifications}
        >
          {isUpdatingNotifications ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.settingsActionButtonText}>
              {notificationPermission === 'granted'
                ? t('mobile.openSystemSettings')
                : t('mobile.enableNotifications')}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {Platform.OS === 'android' && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t('mobile.batteryOptimization')}</Text>
          <Text style={styles.helperText}>{t('mobile.batteryOptimizationHint')}</Text>
          <TouchableOpacity
            style={styles.settingsActionButton}
            onPress={() => void requestIgnoreBatteryOptimizations()}
          >
            <Text style={styles.settingsActionButtonText}>
              {t('mobile.openBatterySettings')}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>{t('mobile.trackingDiagnostics')}</Text>
        <InfoRow
          label={t('mobile.trackingStatus')}
          value={
            trackingMode === 'route'
              ? t('mobile.trackingActiveRoute')
              : trackingMode === 'presence'
                ? t('mobile.trackingActivePresence')
                : t('mobile.trackingInactiveLabel')
          }
        />
        <InfoRow
          label={t('mobile.lastLocationSent')}
          value={lastGpsSentAt ? formatTimeByLocale(lastGpsSentAt, locale) : t('mobile.trackingNeverSent')}
        />
        <InfoRow label={t('mobile.lastSendResult')} value={lastGpsResultLabel} />
        <Text style={styles.helperText}>{t('mobile.trackingDiagnosticsHint')}</Text>
        <TouchableOpacity
          style={[styles.settingsActionButton, isRefreshing && styles.settingsActionButtonDisabled]}
          onPress={() => void refreshPermissions()}
          disabled={isRefreshing}
        >
          {isRefreshing ? (
            <ActivityIndicator size="small" color="#1d4ed8" />
          ) : (
            <Text style={styles.settingsActionButtonText}>{t('mobile.refreshDiagnostics')}</Text>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>{t('mobile.appInfo')}</Text>
        <InfoRow label={t('common.appName')} value={appName} />
        <InfoRow label={t('mobile.version')} value={version} />
        <InfoRow label={t('mobile.runtimeVersion')} value={String(runtimeVersion)} />
      </View>

      <TouchableOpacity
        style={[styles.logoutButton, isLoggingOut && styles.logoutButtonDisabled]}
        onPress={() => void handleLogout()}
        disabled={isLoggingOut}
      >
        {isLoggingOut ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.logoutButtonText}>{t('mobile.signOut')}</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

function PermissionRow({ label, status }: { label: string; status: PermissionState }) {
  const { t } = useTranslation();

  const value =
    status === 'granted'
      ? t('mobile.permissionGranted')
      : status === 'denied'
        ? t('mobile.permissionDenied')
        : t('mobile.permissionUnknown');

  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  content: {
    paddingBottom: 40,
  },
  header: {
    backgroundColor: '#1e3a8a',
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  backText: {
    color: '#bfdbfe',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#fff',
  },
  subtitle: {
    marginTop: 4,
    color: '#bfdbfe',
    fontSize: 13,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 18,
    marginHorizontal: 16,
    marginTop: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  primaryValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  secondaryValue: {
    marginTop: 6,
    fontSize: 13,
    color: '#6b7280',
  },
  helperText: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 12,
  },
  languageRow: {
    flexDirection: 'row',
    gap: 10,
  },
  languageButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  languageButtonActive: {
    backgroundColor: '#eff6ff',
    borderColor: '#2563eb',
  },
  languageButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  languageButtonTextActive: {
    color: '#1d4ed8',
  },
  inlineLoader: {
    marginTop: 12,
  },
  settingsActionButton: {
    marginTop: 12,
    backgroundColor: '#2563eb',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  settingsActionButtonDisabled: {
    opacity: 0.7,
  },
  settingsActionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
  },
  infoLabel: {
    flex: 1,
    fontSize: 14,
    color: '#374151',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginLeft: 12,
  },
  logoutButton: {
    marginTop: 24,
    marginHorizontal: 16,
    backgroundColor: '#dc2626',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
  },
  logoutButtonDisabled: {
    opacity: 0.7,
  },
  logoutButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
