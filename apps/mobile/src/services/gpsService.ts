import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

import { SOCKET_EVENTS } from '@logx/shared';

const GPS_TASK_NAME = 'logx-background-gps';

export interface GpsPayload {
  executionId: string;
  lat: number;
  lng: number;
  speed?: number;
  heading?: number;
  accuracy?: number;
  recordedAt: string;
}

let onLocationCallback: ((payload: GpsPayload) => void) | null = null;
let currentExecutionId: string | null = null;

export function setGpsCallback(callback: (payload: GpsPayload) => void): void {
  onLocationCallback = callback;
}

export function setCurrentExecutionId(id: string | null): void {
  currentExecutionId = id;
}

// Define background task
TaskManager.defineTask(GPS_TASK_NAME, ({ data, error }: { data?: { locations: Location.LocationObject[] }; error: TaskManager.TaskManagerError | null }) => {
  if (error) {
    console.error('[gps] Background task error:', error.message);
    return;
  }

  if (!data?.locations?.length) return;

  const location = data.locations[0];

  if (onLocationCallback && currentExecutionId) {
    onLocationCallback({
      executionId: currentExecutionId,
      lat: location.coords.latitude,
      lng: location.coords.longitude,
      speed: location.coords.speed ?? undefined,
      heading: location.coords.heading ?? undefined,
      accuracy: location.coords.accuracy ?? undefined,
      recordedAt: new Date(location.timestamp).toISOString(),
    });
  }
});

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

  await Location.startLocationUpdatesAsync(GPS_TASK_NAME, {
    accuracy: Location.Accuracy.BestForNavigation,
    timeInterval: 5_000,
    distanceInterval: 10,
    foregroundService: {
      notificationTitle: 'LOGX Express',
      notificationBody: 'Tracking your route…',
      notificationColor: '#1d4ed8',
    },
    pausesUpdatesAutomatically: false,
    activityType: Location.ActivityType.AutomotiveNavigation,
  });

  return true;
}

export async function stopBackgroundGps(): Promise<void> {
  setCurrentExecutionId(null);

  const isRunning = await Location.hasStartedLocationUpdatesAsync(GPS_TASK_NAME);
  if (isRunning) {
    await Location.stopLocationUpdatesAsync(GPS_TASK_NAME);
  }
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
