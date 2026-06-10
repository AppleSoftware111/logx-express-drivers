import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

import { GPS_EMIT_INTERVAL_MS } from '@logx/shared';

import { API_URL } from './api';
import { i18n } from '../i18n';

const GPS_TASK_NAME = 'logx-background-gps';
const ACTIVE_EXECUTION_STORAGE_KEY = 'activeExecutionId';
const GPS_QUEUE_STORAGE_KEY = 'gpsPendingQueue';
const ACCESS_TOKEN_KEY = 'accessToken';
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
  return startBackgroundGps(executionId);
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
  return background === 'granted';
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

export async function getCurrentLocation(): Promise<Location.LocationObject | null> {
  try {
    return await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });
  } catch {
    return null;
  }
}
