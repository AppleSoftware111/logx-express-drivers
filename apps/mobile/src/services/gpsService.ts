import * as Application from 'expo-application';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Alert, Linking, Platform } from 'react-native';

import { GPS_EMIT_INTERVAL_MS } from '@logx/shared';

import { API_URL } from './api';
import { i18n } from '../i18n';

const GPS_TASK_NAME = 'logx-background-gps';
const ACTIVE_EXECUTION_STORAGE_KEY = 'activeExecutionId';
const GPS_QUEUE_STORAGE_KEY = 'gpsPendingQueue';
const ACCESS_TOKEN_KEY = 'accessToken';
const BATTERY_PROMPT_STORAGE_KEY = 'batteryOptimizationPromptShown';
const LAST_GPS_SENT_STORAGE_KEY = 'lastGpsSentAt';
const GPS_QUEUE_LIMIT = 500;
const GPS_BATCH_SIZE = 50;

export interface GpsPayload {
  executionId: string;
  lat: number;
  lng: number;
  speed?: number;
  heading?: number;
  accuracy?: number;
  recordedAt: string;
}

export interface GpsReadiness {
  servicesEnabled: boolean;
  foregroundGranted: boolean;
  backgroundGranted: boolean;
  notificationGranted: boolean;
  ready: boolean;
}

let currentExecutionId: string | null = null;
let foregroundWatch: Location.LocationSubscription | null = null;

export type NotificationPermissionState = 'granted' | 'denied' | 'undetermined';

async function markGpsSentNow(): Promise<void> {
  await AsyncStorage.setItem(LAST_GPS_SENT_STORAGE_KEY, new Date().toISOString());
}

export async function getLastGpsSentAt(): Promise<string | null> {
  return AsyncStorage.getItem(LAST_GPS_SENT_STORAGE_KEY);
}

function requiresNotificationPermission(): boolean {
  return Platform.OS === 'android' && Number(Platform.Version) >= 33;
}

export async function getNotificationPermissionState(): Promise<NotificationPermissionState> {
  if (!requiresNotificationPermission()) {
    return 'granted';
  }

  try {
    const permission = await Notifications.getPermissionsAsync();
    if (permission.granted) {
      return 'granted';
    }

    if (permission.canAskAgain === false || permission.status === 'denied') {
      return 'denied';
    }

    return 'undetermined';
  } catch {
    return 'undetermined';
  }
}

export async function requestNotificationPermission(): Promise<NotificationPermissionState> {
  if (!requiresNotificationPermission()) {
    return 'granted';
  }

  try {
    const permission = await Notifications.requestPermissionsAsync();
    if (permission.granted) {
      return 'granted';
    }

    if (permission.canAskAgain === false || permission.status === 'denied') {
      return 'denied';
    }
  } catch {
    // Fall back to undetermined.
  }

  return 'undetermined';
}

async function readQueuedGpsPayloads(): Promise<GpsPayload[]> {
  const raw = await AsyncStorage.getItem(GPS_QUEUE_STORAGE_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as GpsPayload[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeQueuedGpsPayloads(payloads: GpsPayload[]): Promise<void> {
  await AsyncStorage.setItem(GPS_QUEUE_STORAGE_KEY, JSON.stringify(payloads.slice(-GPS_QUEUE_LIMIT)));
}

async function appendQueuedGpsPayloads(payloads: GpsPayload[]): Promise<void> {
  if (!payloads.length) return;
  const existing = await readQueuedGpsPayloads();
  await writeQueuedGpsPayloads([...existing, ...payloads]);
}

async function getPersistedExecutionId(): Promise<string | null> {
  return AsyncStorage.getItem(ACTIVE_EXECUTION_STORAGE_KEY);
}

export async function consumeQueuedGpsPayloads(): Promise<GpsPayload[]> {
  const payloads = await readQueuedGpsPayloads();
  await AsyncStorage.removeItem(GPS_QUEUE_STORAGE_KEY);
  return payloads;
}

export function setGpsCallback(
  _callback: ((payload: GpsPayload) => Promise<boolean> | boolean) | null
): void {
  // GPS delivery is handled by the background HTTP queue and app-level runtime.
}

export function setCurrentExecutionId(id: string | null): void {
  currentExecutionId = id;
}

function toGpsPayload(
  executionId: string,
  location: Location.LocationObject
): GpsPayload {
  return {
    executionId,
    lat: location.coords.latitude,
    lng: location.coords.longitude,
    speed: location.coords.speed ?? undefined,
    heading: location.coords.heading ?? undefined,
    accuracy: location.coords.accuracy ?? undefined,
    recordedAt: new Date(location.timestamp).toISOString(),
  };
}

async function submitGpsPayloadBatch(payloads: GpsPayload[]): Promise<boolean> {
  if (!payloads.length) return true;

  const accessToken = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
  if (!accessToken) {
    return false;
  }

  try {
    const response = await fetch(`${API_URL}/api/tracking/location`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ points: payloads }),
    });

    if (response.ok) {
      await markGpsSentNow();
    }

    return response.ok;
  } catch {
    return false;
  }
}

export async function flushQueuedGpsPayloads(): Promise<boolean> {
  const queuedPayloads = await readQueuedGpsPayloads();
  if (!queuedPayloads.length) return true;

  const batch = queuedPayloads.slice(0, GPS_BATCH_SIZE);
  const delivered = await submitGpsPayloadBatch(batch);
  if (!delivered) {
    return false;
  }

  await writeQueuedGpsPayloads(queuedPayloads.slice(batch.length));

  if (queuedPayloads.length > batch.length) {
    return flushQueuedGpsPayloads();
  }

  return true;
}

export async function activateTrackedExecution(executionId: string): Promise<boolean> {
  setCurrentExecutionId(executionId);
  await AsyncStorage.setItem(ACTIVE_EXECUTION_STORAGE_KEY, executionId);
  const started = await startBackgroundGps(executionId);
  if (started) {
    void maybePromptBatteryOptimization();
  }
  return started;
}

export async function ensureTrackedExecutionRunning(executionId: string): Promise<boolean> {
  setCurrentExecutionId(executionId);
  await AsyncStorage.setItem(ACTIVE_EXECUTION_STORAGE_KEY, executionId);

  const isRunning = await Location.hasStartedLocationUpdatesAsync(GPS_TASK_NAME);
  if (isRunning) {
    return true;
  }

  return startBackgroundGps(executionId);
}

// Define background task
TaskManager.defineTask(
  GPS_TASK_NAME,
  async ({
    data,
    error,
  }: {
    data?: { locations: Location.LocationObject[] };
    error: TaskManager.TaskManagerError | null;
  }) => {
    if (error) {
      console.error('[gps] Background task error:', error.message);
      return;
    }

    if (!data?.locations?.length) return;

    const executionId = currentExecutionId ?? (await getPersistedExecutionId());

    if (!executionId) return;

    const payloads = data.locations.map((location) => toGpsPayload(executionId, location));

    await appendQueuedGpsPayloads(payloads);
    await flushQueuedGpsPayloads();
  }
);

export async function requestLocationPermissions(): Promise<boolean> {
  const { status: foreground } = await Location.requestForegroundPermissionsAsync();
  if (foreground !== 'granted') return false;

  const { status: background } = await Location.requestBackgroundPermissionsAsync();
  if (background !== 'granted') return false;

  const notificationPermission = await requestNotificationPermission();
  return notificationPermission === 'granted';
}

export async function checkGpsReadiness(): Promise<GpsReadiness> {
  const [servicesEnabled, foreground, background, notificationPermission] = await Promise.all([
    Location.hasServicesEnabledAsync(),
    Location.getForegroundPermissionsAsync(),
    Location.getBackgroundPermissionsAsync(),
    getNotificationPermissionState(),
  ]);

  const foregroundGranted = foreground.status === 'granted';
  const backgroundGranted = background.status === 'granted';
  const notificationGranted = notificationPermission === 'granted';

  return {
    servicesEnabled,
    foregroundGranted,
    backgroundGranted,
    notificationGranted,
    ready: servicesEnabled && foregroundGranted && backgroundGranted && notificationGranted,
  };
}

export async function requestRequiredLocationPermissions(): Promise<GpsReadiness> {
  const servicesEnabled = await Location.hasServicesEnabledAsync();
  const foreground = await Location.requestForegroundPermissionsAsync();
  const background =
    foreground.status === 'granted'
      ? await Location.requestBackgroundPermissionsAsync()
      : await Location.getBackgroundPermissionsAsync();
  const notificationPermission = await requestNotificationPermission();

  const foregroundGranted = foreground.status === 'granted';
  const backgroundGranted = background.status === 'granted';
  const notificationGranted = notificationPermission === 'granted';

  return {
    servicesEnabled,
    foregroundGranted,
    backgroundGranted,
    notificationGranted,
    ready: servicesEnabled && foregroundGranted && backgroundGranted && notificationGranted,
  };
}

export async function ensureGpsReadyForRouteStart(): Promise<GpsReadiness> {
  const current = await checkGpsReadiness();
  if (current.ready) return current;
  return requestRequiredLocationPermissions();
}

export async function startBackgroundGps(executionId: string): Promise<boolean> {
  const hasPermission = await requestLocationPermissions();
  if (!hasPermission) return false;

  setCurrentExecutionId(executionId);
  await AsyncStorage.setItem(ACTIVE_EXECUTION_STORAGE_KEY, executionId);

  const isRunning = await Location.hasStartedLocationUpdatesAsync(GPS_TASK_NAME);
  if (isRunning) {
    return true;
  }

  await Location.startLocationUpdatesAsync(GPS_TASK_NAME, {
    accuracy: Location.Accuracy.BestForNavigation,
    timeInterval: GPS_EMIT_INTERVAL_MS,
    distanceInterval: 10,
    foregroundService: {
      notificationTitle: i18n.t('mobile.gpsNotificationTitle'),
      notificationBody: i18n.t('mobile.gpsNotificationBody'),
      notificationColor: '#1d4ed8',
    },
    pausesUpdatesAutomatically: false,
    activityType: Location.ActivityType.AutomotiveNavigation,
  });

  return true;
}

export async function stopBackgroundGps(): Promise<void> {
  setCurrentExecutionId(null);
  await AsyncStorage.removeItem(ACTIVE_EXECUTION_STORAGE_KEY);
  stopForegroundLocationStream();

  const isRunning = await Location.hasStartedLocationUpdatesAsync(GPS_TASK_NAME);
  if (isRunning) {
    await Location.stopLocationUpdatesAsync(GPS_TASK_NAME);
  }
}

export async function getTrackedExecutionId(): Promise<string | null> {
  return getPersistedExecutionId();
}

export async function hasBackgroundGpsStarted(): Promise<boolean> {
  return Location.hasStartedLocationUpdatesAsync(GPS_TASK_NAME);
}

export function openBatteryOptimizationSettings(): void {
  if (Platform.OS !== 'android') return;

  try {
    Linking.sendIntent('android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS');
  } catch {
    void Linking.openSettings();
  }
}

export async function requestIgnoreBatteryOptimizations(): Promise<void> {
  if (Platform.OS !== 'android') return;

  const packageName = Application.applicationId;

  try {
    if (packageName) {
      await IntentLauncher.startActivityAsync(
        IntentLauncher.ActivityAction.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS,
        { data: `package:${packageName}` }
      );
      return;
    }
  } catch {
    // Some OEMs block the direct dialog; fall back to the battery settings list.
  }

  openBatteryOptimizationSettings();
}

export async function maybePromptBatteryOptimization(): Promise<void> {
  if (Platform.OS !== 'android') return;

  const alreadyShown = await AsyncStorage.getItem(BATTERY_PROMPT_STORAGE_KEY);
  if (alreadyShown === 'true') return;

  await AsyncStorage.setItem(BATTERY_PROMPT_STORAGE_KEY, 'true');

  Alert.alert(
    i18n.t('mobile.batteryOptimizationPromptTitle'),
    i18n.t('mobile.batteryOptimizationPromptBody'),
    [
      { text: i18n.t('mobile.batteryOptimizationLater'), style: 'cancel' },
      {
        text: i18n.t('mobile.batteryOptimizationOpen'),
        onPress: () => {
          void requestIgnoreBatteryOptimizations();
        },
      },
    ]
  );
}

export async function getCurrentLocation(): Promise<Location.LocationObject | null> {
  try {
    return await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });
  } catch {
    return null;
  }
}

async function enqueueAndFlushLocation(
  executionId: string,
  location: Location.LocationObject
): Promise<void> {
  await appendQueuedGpsPayloads([toGpsPayload(executionId, location)]);
  await flushQueuedGpsPayloads();
}

/**
 * Foreground location stream. While the app is open this guarantees continuous
 * updates even if the OS throttles the background foreground-service task.
 */
export async function startForegroundLocationStream(executionId: string): Promise<void> {
  if (foregroundWatch) return;

  const { status } = await Location.getForegroundPermissionsAsync();
  if (status !== 'granted') return;

  setCurrentExecutionId(executionId);

  foregroundWatch = await Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.BestForNavigation,
      timeInterval: GPS_EMIT_INTERVAL_MS,
      distanceInterval: 10,
    },
    (location) => {
      void enqueueAndFlushLocation(executionId, location);
    }
  );
}

export async function ensureForegroundLocationStream(): Promise<void> {
  const executionId = currentExecutionId ?? (await getPersistedExecutionId());
  if (!executionId) return;
  await startForegroundLocationStream(executionId);
}

export function stopForegroundLocationStream(): void {
  if (foregroundWatch) {
    foregroundWatch.remove();
    foregroundWatch = null;
  }
}
