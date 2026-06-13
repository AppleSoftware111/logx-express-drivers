import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';

import type { WorkflowSyncEventInput } from '@logx/shared';

import { apiClient, UPLOAD_REQUEST_TIMEOUT_MS } from './api';
import { getCurrentLocation } from './gpsService';

const WORKFLOW_OUTBOX_KEY = 'routeWorkflowOutbox';
const WORKFLOW_OUTBOX_LIMIT = 200;

export type WorkflowAction = WorkflowSyncEventInput['action'];

type WorkflowOutboxEvent = WorkflowSyncEventInput & {
  retryCount: number;
  lastError?: string;
  createdAt: string;
};

type WorkflowDraft = {
  action: WorkflowAction;
  executionId: string;
  stopId?: string;
  notes?: string;
  receiverName?: string;
  photoKey?: string;
  signatureKey?: string;
  metadata?: Record<string, unknown>;
};

function createClientEventId(action: WorkflowAction, executionId: string, stopId?: string): string {
  return `${action}:${executionId}:${stopId ?? 'route'}:${Date.now()}:${Math.random()
    .toString(36)
    .slice(2)}`;
}

async function readOutbox(): Promise<WorkflowOutboxEvent[]> {
  const raw = await AsyncStorage.getItem(WORKFLOW_OUTBOX_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as WorkflowOutboxEvent[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeOutbox(events: WorkflowOutboxEvent[]): Promise<void> {
  await AsyncStorage.setItem(
    WORKFLOW_OUTBOX_KEY,
    JSON.stringify(events.slice(-WORKFLOW_OUTBOX_LIMIT))
  );
}

function endpointForEvent(event: WorkflowSyncEventInput): string {
  if (event.action === 'ROUTE_RECEIVED') return `/executions/${event.executionId}/received`;
  if (event.action === 'ROUTE_COMPLETED') return `/executions/${event.executionId}/completed`;
  if (event.action === 'STOP_ON_THE_WAY') {
    return `/executions/${event.executionId}/stops/${event.stopId}/on-the-way`;
  }
  if (event.action === 'STOP_ARRIVED') {
    return `/executions/${event.executionId}/stops/${event.stopId}/workflow-arrived`;
  }
  if (event.action === 'STOP_COLLECTED') {
    return `/executions/${event.executionId}/stops/${event.stopId}/collected`;
  }
  return `/executions/${event.executionId}/stops/${event.stopId}/workflow-skip`;
}

async function uploadLocalProofIfNeeded(event: WorkflowOutboxEvent): Promise<WorkflowOutboxEvent> {
  const localPhotoUri = event.metadata?.localPhotoUri;
  if (event.action !== 'STOP_COLLECTED' || event.photoKey || typeof localPhotoUri !== 'string') {
    return event;
  }

  const fileInfo = await FileSystem.getInfoAsync(localPhotoUri);
  if (!fileInfo.exists) {
    return {
      ...event,
      metadata: {
        ...event.metadata,
        proofUploadSkipped: 'local_photo_missing',
      },
    };
  }

  const formData = new FormData();
  formData.append('photo', {
    uri: localPhotoUri,
    type: 'image/jpeg',
    name: 'collection-photo.jpg',
  } as unknown as Blob);

  const res = await apiClient.post<{
    success: true;
    data: { photoKey?: string; signatureKey?: string };
  }>(`/pod/${event.executionId}/stops/${event.stopId}`, formData, {
    timeout: UPLOAD_REQUEST_TIMEOUT_MS,
  });

  return {
    ...event,
    photoKey: res.data.data.photoKey ?? event.photoKey,
    signatureKey: res.data.data.signatureKey ?? event.signatureKey,
  };
}

async function submitWorkflowEvent(event: WorkflowOutboxEvent): Promise<void> {
  const uploadReadyEvent = await uploadLocalProofIfNeeded(event);

  await apiClient.post(endpointForEvent(uploadReadyEvent), {
    clientEventId: uploadReadyEvent.clientEventId,
    occurredAt: uploadReadyEvent.occurredAt,
    gps: uploadReadyEvent.gps,
    resolvedAddress: uploadReadyEvent.resolvedAddress,
    notes: uploadReadyEvent.notes,
    receiverName: uploadReadyEvent.receiverName,
    photoKey: uploadReadyEvent.photoKey,
    signatureKey: uploadReadyEvent.signatureKey,
    metadata: uploadReadyEvent.metadata,
  });
}

export async function flushWorkflowOutbox(): Promise<void> {
  const outbox = await readOutbox();
  if (!outbox.length) return;

  const remaining: WorkflowOutboxEvent[] = [];

  for (const event of outbox) {
    try {
      await submitWorkflowEvent(event);
    } catch (error) {
      const err = error as { message?: string };
      remaining.push({
        ...event,
        retryCount: event.retryCount + 1,
        lastError: err.message ?? 'sync_failed',
      });
    }
  }

  await writeOutbox(remaining);
}

export async function getWorkflowOutboxCount(): Promise<number> {
  return (await readOutbox()).length;
}

export async function createWorkflowEvent(draft: WorkflowDraft): Promise<WorkflowOutboxEvent> {
  const currentLocation = await getCurrentLocation();
  const occurredAt = new Date().toISOString();

  return {
    clientEventId: createClientEventId(draft.action, draft.executionId, draft.stopId),
    action: draft.action,
    executionId: draft.executionId,
    stopId: draft.stopId,
    occurredAt,
    gps: currentLocation
      ? {
          lat: currentLocation.coords.latitude,
          lng: currentLocation.coords.longitude,
          speed: currentLocation.coords.speed ?? undefined,
          heading: currentLocation.coords.heading ?? undefined,
          accuracy: currentLocation.coords.accuracy ?? undefined,
          recordedAt: new Date(currentLocation.timestamp).toISOString(),
        }
      : undefined,
    notes: draft.notes,
    receiverName: draft.receiverName,
    photoKey: draft.photoKey,
    signatureKey: draft.signatureKey,
    metadata: draft.metadata,
    retryCount: 0,
    createdAt: occurredAt,
  };
}

export async function submitOrQueueWorkflowEvent(draft: WorkflowDraft): Promise<'synced' | 'queued'> {
  const event = await createWorkflowEvent(draft);

  try {
    await submitWorkflowEvent(event);
    await flushWorkflowOutbox();
    return 'synced';
  } catch (error) {
    const err = error as { message?: string };
    const outbox = await readOutbox();
    await writeOutbox([
      ...outbox,
      {
        ...event,
        retryCount: event.retryCount + 1,
        lastError: err.message ?? 'queued_for_sync',
      },
    ]);
    return 'queued';
  }
}
