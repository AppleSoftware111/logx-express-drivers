import * as Application from 'expo-application';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, Linking, Platform } from 'react-native';

import { GPS_EMIT_INTERVAL_MS, GPS_PRESENCE_INTERVAL_MS } from '@logx/shared';

import { apiClient, ensureFreshToken, getAccessTokenDriverId, rotateAuthSession, setBackgroundTaskContext, UPLOAD_REQUEST_TIMEOUT_MS } from './api';
import { i18n } from '../i18n';

const GPS_TASK_NAME = 'logx-background-gps';
const ACTIVE_EXECUTION_STORAGE_KEY = 'activeExecutionId';
const GPS_QUEUE_STORAGE_KEY = 'gpsPendingQueue';
const BATTERY_PROMPT_STORAGE_KEY = 'batteryOptimizationPromptShown';
const LAST_GPS_SENT_STORAGE_KEY = 'lastGpsSentAt';
const LAST_GPS_RESULT_STORAGE_KEY = 'lastGpsSendResult';
const LAST_GPS_TASK_FIRED_STORAGE_KEY = 'lastGpsTaskFiredAt';
const LAST_GPS_TASK_ERROR_STORAGE_KEY = 'lastGpsTaskError';
const GPS_MODE_STORAGE_KEY = 'gpsTrackingMode';
const GPS_QUEUE_LIMIT = 500;
const GPS_BATCH_SIZE = 50;
const GPS_QUEUE_RECOVERY_THRESHOLD = 25;
const GPS_QUEUE_KEEP_ON_FAILURE = 5;
const GPS_QUEUE_RECOVERY_KEEP = 10;
export const GPS_STALE_UPLOAD_MS = 2 * 60_000;
export const GPS_BACKGROUND_RECOVERY_INTERVAL_MS = 120_000;
export const GPS_AUTO_RECOVERY_INTERVAL_MS = 90_000;
const LOCATION_START_TIMEOUT_MS = 20_000;

export type GpsStartOptions = {
  /** When false, only checks existing grants — does not open system permission dialogs. */
  requestPermissions?: boolean;
};

export type GpsTrackingMode = 'route' | 'presence' | 'off';

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
let foregroundWatchMode: GpsTrackingMode | 'off' = 'off';

export type NotificationPermissionState = 'granted' | 'denied' | 'undetermined';

async function markGpsSentNow(): Promise<void> {
  await AsyncStorage.setItem(LAST_GPS_SENT_STORAGE_KEY, new Date().toISOString());
}

async function getPersistedGpsMode(): Promise<GpsTrackingMode> {
  const mode = await AsyncStorage.getItem(GPS_MODE_STORAGE_KEY);
  if (mode === 'route' || mode === 'presence') return mode;
  return 'off';
}

async function setPersistedGpsMode(mode: GpsTrackingMode): Promise<void> {
  if (mode === 'off') {
    await AsyncStorage.removeItem(GPS_MODE_STORAGE_KEY);
  } else {
    await AsyncStorage.setItem(GPS_MODE_STORAGE_KEY, mode);
  }
}

export async function getGpsTrackingMode(): Promise<GpsTrackingMode> {
  const isRunning = await Location.hasStartedLocationUpdatesAsync(GPS_TASK_NAME);
  if (!isRunning) return 'off';
  return getPersistedGpsMode();
}

export async function getLastGpsSentAt(): Promise<string | null> {
  return AsyncStorage.getItem(LAST_GPS_SENT_STORAGE_KEY);
}

/** Call on logout so diagnostics don't show stale results from the previous session. */
export async function clearGpsDiagnostics(): Promise<void> {
  await AsyncStorage.multiRemove([
    LAST_GPS_SENT_STORAGE_KEY,
    LAST_GPS_RESULT_STORAGE_KEY,
    LAST_GPS_TASK_FIRED_STORAGE_KEY,
    LAST_GPS_TASK_ERROR_STORAGE_KEY,
  ]);
}

async function setLastGpsSendResult(result: string): Promise<void> {
  await AsyncStorage.setItem(LAST_GPS_RESULT_STORAGE_KEY, result);
}

export async function getLastGpsSendResult(): Promise<string | null> {
  return AsyncStorage.getItem(LAST_GPS_RESULT_STORAGE_KEY);
}

export async function getLastGpsTaskFiredAt(): Promise<string | null> {
  return AsyncStorage.getItem(LAST_GPS_TASK_FIRED_STORAGE_KEY);
}

export async function getLastGpsTaskError(): Promise<string | null> {
  return AsyncStorage.getItem(LAST_GPS_TASK_ERROR_STORAGE_KEY);
}

export async function isGpsUploadStale(): Promise<boolean> {
  const [lastSentAt, mode] = await Promise.all([getLastGpsSentAt(), getGpsTrackingMode()]);
  if (mode === 'off') return false;
  if (!lastSentAt) return true;
  return Date.now() - new Date(lastSentAt).getTime() > GPS_STALE_UPLOAD_MS;
}

export async function getGpsUploadHealth(): Promise<{
  stale: boolean;
  lastResult: string | null;
  queueDepth: number;
  taskFiredAt: string | null;
  backgroundRunning: boolean;
}> {
  const [stale, lastResult, queueDepth, taskFiredAt, backgroundRunning] = await Promise.all([
    isGpsUploadStale(),
    getLastGpsSendResult(),
    getQueuedGpsPayloadCount(),
    getLastGpsTaskFiredAt(),
    hasBackgroundGpsStarted(),
  ]);

  return {
    stale,
    lastResult,
    queueDepth,
    taskFiredAt,
    backgroundRunning,
  };
}

export async function getQueuedGpsPayloadCount(): Promise<number> {
  const queued = await readQueuedGpsPayloads();
  return queued.length;
}

async function markGpsTaskFired(_locationCount: number): Promise<void> {
  await AsyncStorage.setItem(LAST_GPS_TASK_FIRED_STORAGE_KEY, new Date().toISOString());
  await AsyncStorage.removeItem(LAST_GPS_TASK_ERROR_STORAGE_KEY);
}

async function markGpsTaskError(message: string): Promise<void> {
  await AsyncStorage.setItem(LAST_GPS_TASK_ERROR_STORAGE_KEY, message);
}

/** Clears a stale 401/403 when the session was refreshed — never clears other errors. */
export async function reconcileStaleGpsSendResult(): Promise<void> {
  const result = await getLastGpsSendResult();
  if (result !== 'http_401' && result !== 'http_403') {
    return;
  }

  const tokenOk = await ensureFreshToken({ logoutOnFailure: false });
  if (!tokenOk) {
    return;
  }

  if (result === 'http_403') {
    const driverId = await getAccessTokenDriverId();
    if (driverId) {
      await AsyncStorage.removeItem(LAST_GPS_RESULT_STORAGE_KEY);
      await AsyncStorage.removeItem(LAST_GPS_TASK_ERROR_STORAGE_KEY);
      return;
    }

    const rotated = await rotateAuthSession();
    if (rotated && (await getAccessTokenDriverId())) {
      await AsyncStorage.removeItem(LAST_GPS_RESULT_STORAGE_KEY);
      await AsyncStorage.removeItem(LAST_GPS_TASK_ERROR_STORAGE_KEY);
    }
    return;
  }

  await AsyncStorage.removeItem(LAST_GPS_RESULT_STORAGE_KEY);
}

function isFailedUploadResult(result: string | null): boolean {
  return Boolean(result && result !== 'ok');
}

function shouldCapQueueGrowth(lastResult: string | null, existingLength: number): boolean {
  if (existingLength >= GPS_QUEUE_RECOVERY_THRESHOLD) {
    return true;
  }
  if (!lastResult || lastResult === 'ok') {
    return false;
  }
  return (
    lastResult === 'http_401' ||
    lastResult === 'http_403' ||
    lastResult === 'network_error' ||
    lastResult === 'ECONNABORTED' ||
    lastResult.startsWith('http_')
  );
}

async function recoverOversizedQueue(): Promise<number> {
  const queued = await readQueuedGpsPayloads();
  if (queued.length <= GPS_QUEUE_RECOVERY_THRESHOLD) {
    return 0;
  }
  const trimmed = queued.slice(-GPS_QUEUE_RECOVERY_KEEP);
  await writeQueuedGpsPayloads(trimmed);
  return queued.length - trimmed.length;
}

async function uploadLatestQueuedPoint(): Promise<boolean> {
  const queued = await readQueuedGpsPayloads();
  if (!queued.length) {
    return true;
  }
  const latest = queued[queued.length - 1];
  const sent = await submitGpsPayloadBatch([latest]);
  if (!sent) {
    return false;
  }
  if (queued.length > 1) {
    await writeQueuedGpsPayloads(queued.slice(-1));
  }
  await AsyncStorage.removeItem(LAST_GPS_TASK_ERROR_STORAGE_KEY);
  return true;
}

/**
 * Automatically repairs stalled GPS uploads: trims stale backlog, refreshes session,
 * and prioritizes the newest location so live tracking resumes without manual steps.
 */
export async function autoRecoverGpsUploads(options?: {
  aggressive?: boolean;
  background?: boolean;
}): Promise<boolean> {
  await reconcileStaleGpsSendResult();

  const [lastResult, queueDepth, lastSentAt] = await Promise.all([
    getLastGpsSendResult(),
    getQueuedGpsPayloadCount(),
    getLastGpsSentAt(),
  ]);

  const staleMs = lastSentAt ? Date.now() - new Date(lastSentAt).getTime() : Number.POSITIVE_INFINITY;
  const needsRecovery =
    options?.aggressive ||
    queueDepth > GPS_QUEUE_RECOVERY_THRESHOLD ||
    isFailedUploadResult(lastResult) ||
    staleMs > GPS_STALE_UPLOAD_MS;

  if (!needsRecovery && queueDepth === 0) {
    return true;
  }

  await pruneGpsQueueToTrackedExecution();

  if (queueDepth > GPS_QUEUE_RECOVERY_THRESHOLD || options?.aggressive) {
    await recoverOversizedQueue();
  }

  const shouldRotateSession =
    lastResult === 'http_401' ||
    lastResult === 'http_403' ||
    staleMs > GPS_STALE_UPLOAD_MS ||
    options?.aggressive;

  if (shouldRotateSession && !options?.background) {
    await rotateAuthSession();
  } else if (shouldRotateSession) {
    await ensureFreshToken({ logoutOnFailure: false });
  } else {
    await ensureFreshToken({ logoutOnFailure: false });
  }

  await renormalizeQueuedGpsPayloads();

  const latestSent = await uploadLatestQueuedPoint();
  if (!latestSent) {
    return false;
  }

  if (options?.background) {
    await ensureFreshToken({ logoutOnFailure: false });
    await renormalizeQueuedGpsPayloads();
    const latestSent = await uploadLatestQueuedPoint();
    if (!latestSent) {
      return false;
    }
    return true;
  }

  return flushQueuedGpsPayloads();
}

function withGpsTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('location_start_timeout')), ms);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error: unknown) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

function describeGpsSendError(error: unknown): string {
  const err = error as { response?: { status?: number }; code?: string };
  if (typeof err.response?.status === 'number') {
    return `http_${err.response.status}`;
  }
  if (err.code) {
    return err.code;
  }
  return 'network_error';
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
  const lastResult = await getLastGpsSendResult();

  if (shouldCapQueueGrowth(lastResult, existing.length)) {
    await writeQueuedGpsPayloads([...existing, ...payloads].slice(-GPS_QUEUE_KEEP_ON_FAILURE));
    return;
  }

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

function sanitizeGpsMetric(
  value: number | null | undefined,
  min: number,
  max?: number
): number | undefined {
  if (value == null || !Number.isFinite(value) || value < min) {
    return undefined;
  }
  if (max != null && value > max) {
    return undefined;
  }
  return value;
}

function sanitizeGpsPayload(payload: GpsPayload): GpsPayload {
  return {
    ...payload,
    speed: sanitizeGpsMetric(payload.speed, 0),
    heading: sanitizeGpsMetric(payload.heading, 0, 360),
    accuracy: sanitizeGpsMetric(payload.accuracy, 0),
  };
}

function presencePayloadFromLocation(location: Location.LocationObject) {
  return {
    lat: location.coords.latitude,
    lng: location.coords.longitude,
    speed: sanitizeGpsMetric(location.coords.speed, 0),
    heading: sanitizeGpsMetric(location.coords.heading, 0, 360),
    accuracy: sanitizeGpsMetric(location.coords.accuracy, 0),
    recordedAt: new Date(location.timestamp).toISOString(),
  };
}

function toGpsPayload(
  executionId: string,
  location: Location.LocationObject
): GpsPayload {
  return sanitizeGpsPayload({
    executionId,
    lat: location.coords.latitude,
    lng: location.coords.longitude,
    speed: location.coords.speed ?? undefined,
    heading: location.coords.heading ?? undefined,
    accuracy: location.coords.accuracy ?? undefined,
    recordedAt: new Date(location.timestamp).toISOString(),
  });
}

/** Re-sanitize any points already in the offline queue (e.g. after an app update). */
export async function renormalizeQueuedGpsPayloads(): Promise<number> {
  const queued = await readQueuedGpsPayloads();
  if (!queued.length) return 0;
  const sanitized = queued.map(sanitizeGpsPayload);
  await writeQueuedGpsPayloads(sanitized);
  return sanitized.length;
}

async function submitPresenceLocation(
  location: Location.LocationObject,
  allowAuthRetry = true
): Promise<boolean> {
  const tokenOk = await ensureFreshToken({ logoutOnFailure: false });
  if (!tokenOk) {
    await setLastGpsSendResult('http_401');
    return false;
  }

  try {
    await apiClient.post('/tracking/presence', presencePayloadFromLocation(location), {
      timeout: UPLOAD_REQUEST_TIMEOUT_MS,
    });
    await markGpsSentNow();
    await setLastGpsSendResult('ok');
    return true;
  } catch (error) {
    const errorCode = describeGpsSendError(error);

    if ((errorCode === 'http_403' || errorCode === 'http_401') && allowAuthRetry) {
      const rotated = await rotateAuthSession();
      if (rotated) {
        return submitPresenceLocation(location, false);
      }
    }
    await setLastGpsSendResult(errorCode);
    return false;
  }
}

async function submitGpsPayloadBatch(payloads: GpsPayload[], allowAuthRetry = true): Promise<boolean> {
  if (!payloads.length) return true;

  const sanitized = payloads.map(sanitizeGpsPayload);

  const tokenOk = await ensureFreshToken({ logoutOnFailure: false });
  if (!tokenOk) {
    await setLastGpsSendResult('http_401');
    return false;
  }

  try {
    await apiClient.post(
      '/tracking/location',
      { points: sanitized },
      { timeout: UPLOAD_REQUEST_TIMEOUT_MS }
    );
    await markGpsSentNow();
    await setLastGpsSendResult('ok');
    return true;
  } catch (error) {
    const errorCode = describeGpsSendError(error);

    if ((errorCode === 'http_403' || errorCode === 'http_401') && allowAuthRetry) {
      const rotated = await rotateAuthSession();
      if (rotated) {
        return submitGpsPayloadBatch(payloads, false);
      }
    }

    if (errorCode === 'http_400' && sanitized.length > 1) {
      let accepted = 0;
      for (const point of sanitized) {
        if (await submitGpsPayloadBatch([point], allowAuthRetry)) {
          accepted += 1;
        }
      }
      if (accepted > 0) {
        return true;
      }
    }

    await setLastGpsSendResult(errorCode);
    return false;
  }
}

export async function flushQueuedGpsPayloads(): Promise<boolean> {
  const queuedPayloads = await readQueuedGpsPayloads();
  if (!queuedPayloads.length) return true;

  const batch = queuedPayloads.slice(0, GPS_BATCH_SIZE).map(sanitizeGpsPayload);
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

/** Drops queued points that do not belong to the currently tracked execution. */
export async function pruneGpsQueueToTrackedExecution(): Promise<number> {
  const executionId = await getPersistedExecutionId();
  if (!executionId) return 0;

  const queued = await readQueuedGpsPayloads();
  const matching = queued.filter((point) => point.executionId === executionId);
  const dropped = queued.length - matching.length;
  if (dropped > 0) {
    await writeQueuedGpsPayloads(matching);
  }
  return dropped;
}

export async function clearGpsQueue(): Promise<void> {
  await AsyncStorage.removeItem(GPS_QUEUE_STORAGE_KEY);
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

export async function ensureTrackedExecutionRunning(
  executionId: string,
  options: GpsStartOptions = { requestPermissions: false }
): Promise<boolean> {
  setCurrentExecutionId(executionId);
  await AsyncStorage.setItem(ACTIVE_EXECUTION_STORAGE_KEY, executionId);

  const isRunning = await Location.hasStartedLocationUpdatesAsync(GPS_TASK_NAME);
  if (isRunning) {
    return true;
  }

  return startBackgroundGps(executionId, options);
}

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
      await markGpsTaskError(error.message);
      return;
    }

    if (!data?.locations?.length) return;

    await markGpsTaskFired(data.locations.length);

    setBackgroundTaskContext(true);
    try {
      const mode = await getPersistedGpsMode();
      const executionId = currentExecutionId ?? (await getPersistedExecutionId());

      if (mode === 'route' && executionId) {
        const payloads = data.locations.map((location) => toGpsPayload(executionId, location));
        await appendQueuedGpsPayloads(payloads);
        let flushed = await flushQueuedGpsPayloads();
        if (!flushed) {
          flushed = await autoRecoverGpsUploads({ background: true });
        }
        if (!flushed) {
          const lastResult = await getLastGpsSendResult();
          await markGpsTaskError(lastResult ?? 'upload_failed');
        }
      } else if (mode === 'presence') {
        const latest = data.locations[data.locations.length - 1];
        let sent = await submitPresenceLocation(latest);
        if (!sent) {
          await rotateAuthSession();
          sent = await submitPresenceLocation(latest, false);
        }
        if (!sent) {
          const lastResult = await getLastGpsSendResult();
          await markGpsTaskError(lastResult ?? 'upload_failed');
        }
      }
    } catch (taskError) {
      const message = taskError instanceof Error ? taskError.message : 'task_failed';
      await markGpsTaskError(message);
      console.error('[gps] Background task handler failed:', taskError);
    } finally {
      setBackgroundTaskContext(false);
    }
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

async function ensurePermissionsForGpsStart(options: GpsStartOptions): Promise<boolean> {
  const readiness = await checkGpsReadiness();
  if (readiness.ready) {
    return true;
  }

  if (options.requestPermissions === false) {
    return false;
  }

  return requestLocationPermissions();
}

async function startLocationTask(
  interval: number,
  notificationBody: string
): Promise<boolean> {
  const isRunning = await Location.hasStartedLocationUpdatesAsync(GPS_TASK_NAME);
  if (isRunning) {
    await Location.stopLocationUpdatesAsync(GPS_TASK_NAME);
  }

  try {
    await withGpsTimeout(
      Location.startLocationUpdatesAsync(GPS_TASK_NAME, {
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: interval,
        distanceInterval: interval === GPS_EMIT_INTERVAL_MS ? 10 : 50,
        foregroundService: {
          notificationTitle: i18n.t('mobile.gpsNotificationTitle'),
          notificationBody,
          notificationColor: '#1d4ed8',
        },
        pausesUpdatesAutomatically: false,
        activityType: Location.ActivityType.AutomotiveNavigation,
        showsBackgroundLocationIndicator: true,
      }),
      LOCATION_START_TIMEOUT_MS
    );
    return true;
  } catch (error) {
    console.error('[gps] Failed to start location updates:', error);
    return false;
  }
}

export async function startBackgroundGps(
  executionId: string,
  options: GpsStartOptions = { requestPermissions: true }
): Promise<boolean> {
  const hasPermission = await ensurePermissionsForGpsStart(options);
  if (!hasPermission) return false;

  setCurrentExecutionId(executionId);
  await AsyncStorage.setItem(ACTIVE_EXECUTION_STORAGE_KEY, executionId);
  await setPersistedGpsMode('route');

  const started = await startLocationTask(GPS_EMIT_INTERVAL_MS, i18n.t('mobile.gpsNotificationBody'));
  if (started) {
    await startForegroundLocationStream(executionId);
  }
  return started;
}

export async function startPresenceGps(
  options: GpsStartOptions = { requestPermissions: true }
): Promise<boolean> {
  const hasPermission = await ensurePermissionsForGpsStart(options);
  if (!hasPermission) return false;

  await setPersistedGpsMode('presence');

  const started = await startLocationTask(
    GPS_PRESENCE_INTERVAL_MS,
    i18n.t('mobile.gpsPresenceNotificationBody')
  );
  if (started) {
    await startPresenceForegroundStream();
  }
  return started;
}

export async function stopBackgroundGps(): Promise<void> {
  setCurrentExecutionId(null);
  await AsyncStorage.removeItem(ACTIVE_EXECUTION_STORAGE_KEY);
  await setPersistedGpsMode('off');
  stopForegroundLocationStream();

  const isRunning = await Location.hasStartedLocationUpdatesAsync(GPS_TASK_NAME);
  if (isRunning) {
    await Location.stopLocationUpdatesAsync(GPS_TASK_NAME);
  }
}

export async function stopPresenceGps(): Promise<void> {
  await setPersistedGpsMode('off');

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

async function startForegroundWatch(
  mode: GpsTrackingMode,
  executionId?: string | null
): Promise<void> {
  const { status } = await Location.getForegroundPermissionsAsync();
  if (status !== 'granted') return;

  if (foregroundWatch && foregroundWatchMode === mode) {
    return;
  }

  stopForegroundLocationStream();

  if (mode === 'route' && executionId) {
    setCurrentExecutionId(executionId);
    foregroundWatchMode = 'route';
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
    return;
  }

  if (mode === 'presence') {
    foregroundWatchMode = 'presence';
    foregroundWatch = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: GPS_PRESENCE_INTERVAL_MS,
        distanceInterval: 50,
      },
      (location) => {
        void submitPresenceLocation(location);
      }
    );
  }
}

/**
 * Foreground location stream. Keeps sending while the app is open or locked
 * (when combined with the Android foreground-service notification).
 */
export async function startForegroundLocationStream(executionId: string): Promise<void> {
  await startForegroundWatch('route', executionId);
}

export async function startPresenceForegroundStream(): Promise<void> {
  await startForegroundWatch('presence');
}

export async function ensureForegroundLocationStream(): Promise<void> {
  const mode = await getGpsTrackingMode();
  if (mode === 'route') {
    const executionId = currentExecutionId ?? (await getPersistedExecutionId());
    if (!executionId) return;
    await startForegroundLocationStream(executionId);
    return;
  }

  if (mode === 'presence') {
    await startPresenceForegroundStream();
  }
}

export function stopForegroundLocationStream(): void {
  if (foregroundWatch) {
    foregroundWatch.remove();
    foregroundWatch = null;
  }
  foregroundWatchMode = 'off';
}
