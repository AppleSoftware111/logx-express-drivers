import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { i18n } from '../i18n';

const GPS_TASK_NAME = 'logx-background-gps';
const ACTIVE_EXECUTION_STORAGE_KEY = 'activeExecutionId';
const GPS_QUEUE_STORAGE_KEY = 'gpsPendingQueue';

export interface GpsPayload {
  executionId: string;
  lat: number;
  lng: number;
  speed?: number;
  heading?: number;
  accuracy?: number;
  recordedAt: string;
}

let onLocationCallback: ((payload: GpsPayload) => Promise<boolean> | boolean) | null = null;
let currentExecutionId: string | null = null;

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
  await AsyncStorage.setItem(GPS_QUEUE_STORAGE_KEY, JSON.stringify(payloads.slice(-200)));
}

async function appendQueuedGpsPayload(payload: GpsPayload): Promise<void> {
  const existing = await readQueuedGpsPayloads();
  existing.push(payload);
  await writeQueuedGpsPayloads(existing);
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
  callback: ((payload: GpsPayload) => Promise<boolean> | boolean) | null
): void {
  onLocationCallback = callback;
}

export function setCurrentExecutionId(id: string | null): void {
  currentExecutionId = id;
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

    const location = data.locations[0];
    const executionId = currentExecutionId ?? (await getPersistedExecutionId());

    if (!executionId) return;

    const payload: GpsPayload = {
      executionId,
      lat: location.coords.latitude,
      lng: location.coords.longitude,
      speed: location.coords.speed ?? undefined,
      heading: location.coords.heading ?? undefined,
      accuracy: location.coords.accuracy ?? undefined,
      recordedAt: new Date(location.timestamp).toISOString(),
    };

    let delivered = false;

    if (onLocationCallback) {
      try {
        delivered = await onLocationCallback(payload);
      } catch {
        delivered = false;
      }
    }

    if (!delivered) {
      await appendQueuedGpsPayload(payload);
    }
  }
);

export async function requestLocationPermissions(): Promise<boolean> {
  const { status: foreground } = await Location.requestForegroundPermissionsAsync();
  if (foreground !== 'granted') return false;

  const { status: background } = await Location.requestBackgroundPermissionsAsync();
  return background === 'granted';
}

export async function startBackgroundGps(executionId: string): Promise<boolean> {
  const hasPermission = await requestLocationPermissions();
  if (!hasPermission) return false;

  setCurrentExecutionId(executionId);
  await AsyncStorage.setItem(ACTIVE_EXECUTION_STORAGE_KEY, executionId);

  await Location.startLocationUpdatesAsync(GPS_TASK_NAME, {
    accuracy: Location.Accuracy.BestForNavigation,
    timeInterval: 5_000,
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

  const isRunning = await Location.hasStartedLocationUpdatesAsync(GPS_TASK_NAME);
  if (isRunning) {
    await Location.stopLocationUpdatesAsync(GPS_TASK_NAME);
  }
}

export async function getTrackedExecutionId(): Promise<string | null> {
  return getPersistedExecutionId();
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
