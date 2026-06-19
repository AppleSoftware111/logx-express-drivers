import type {
  CompleteStopInput,
  SubstituteDriverInput,
  UpdateExecutionStatusInput,
  WorkflowActionInput,
  WorkflowSyncEventInput,
} from '@logx/shared';

import { ApiErrorCode } from '@logx/i18n';

import { AppError } from '../../middleware/errorHandler';
import { Alert } from '../../models/Alert.model';
import { GpsPoint } from '../../models/GpsPoint.model';
import { Route } from '../../models/Route.model';
import { RouteExecution, type IRouteExecution } from '../../models/RouteExecution.model';
import { RouteExecutionAudit, type RouteExecutionAuditAction } from '../../models/RouteExecutionAudit.model';
import { SOCKET_EVENTS } from '@logx/shared';
import { localizeAlertDocument } from '../alerts/alert.service';
import { invalidateCache } from '../../utils/cache';
import { emitExecutionRealtimeUpdate } from '../../socket/realtime';
import { haversineDistance } from '../../utils/haversine';
import {
  businessDateStringToUtcDate,
  calcDelayMinutes,
  calcWaitingMinutes,
  getCurrentBusinessDate,
  routeRunsOnDate,
  toDateString,
} from '../../utils/timeCalc';

type ExecutionActor = {
  userId?: string;
  role: string;
  driverId?: string;
};

type WorkflowSource = 'mobile_online' | 'mobile_offline_sync' | 'geofence' | 'admin';

export function touchDashboard(companyId: string) {
  void invalidateCache(`dashboard:summary:${companyId}:*`);
}

export function syncExecutionLifecycle(execution: IRouteExecution) {
  const relevantStops = execution.stops.filter((stop) => stop.status !== 'PENDING');
  const hasStarted = relevantStops.length > 0;
  const allStopsResolved =
    execution.stops.length > 0 &&
    execution.stops.every((stop) => ['COMPLETED', 'SKIPPED'].includes(stop.status));

  if (hasStarted && ['PENDING', 'ASSIGNED', 'ACCEPTED'].includes(execution.status)) {
    execution.status = 'IN_PROGRESS';
  }

  if (hasStarted && !execution.actualStartTime) {
    const firstActivity = relevantStops
      .flatMap((stop) => [stop.onTheWayAt, stop.arrivedAt, stop.startedAt, stop.completedAt])
      .find((timestamp): timestamp is Date => timestamp instanceof Date);
    execution.actualStartTime = firstActivity ?? new Date();
  }

  if (execution.actualStartTime) {
    execution.delayMinutes = calcDelayMinutes(
      execution.scheduledDate,
      execution.scheduledTime,
      execution.actualStartTime
    );
  }

  if (allStopsResolved) {
    execution.status = 'COMPLETED';
    if (!execution.actualEndTime) {
      const latestStopTime = execution.stops
        .flatMap((stop) => [stop.completedAt, stop.startedAt, stop.arrivedAt, stop.onTheWayAt])
        .filter((timestamp): timestamp is Date => timestamp instanceof Date)
        .sort((left, right) => right.getTime() - left.getTime())[0];
      execution.actualEndTime = latestStopTime ?? new Date();
    }

    if (execution.actualStartTime && execution.actualEndTime) {
      execution.totalDurationMinutes = Math.max(
        0,
        Math.round((execution.actualEndTime.getTime() - execution.actualStartTime.getTime()) / 60_000)
      );
    }
  }
}

function ensureExecutionActorAccess(
  execution: {
    driverId?: { toString(): string } | string | null;
  },
  actor?: ExecutionActor
) {
  if (!actor || actor.role !== 'DRIVER') return;

  const assignedDriverId = execution.driverId ? String(execution.driverId) : undefined;
  if (!actor.driverId || !assignedDriverId || actor.driverId !== assignedDriverId) {
    throw new AppError(ApiErrorCode.FORBIDDEN, 403);
  }
}

function getOccurredAt(input?: WorkflowActionInput): Date {
  const parsed = input?.occurredAt ? new Date(input.occurredAt) : new Date();
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function getGpsRecordedAt(input?: WorkflowActionInput): Date | undefined {
  if (!input?.gps?.recordedAt) return undefined;
  const parsed = new Date(input.gps.recordedAt);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function buildClientEventId(
  action: RouteExecutionAuditAction,
  executionId: string,
  stopId: string | undefined,
  input?: WorkflowActionInput
): string {
  return input?.clientEventId ?? `${action}:${executionId}:${stopId ?? 'route'}:${getOccurredAt(input).toISOString()}`;
}

function getDistanceMeters(
  stop: { location?: { lat: number; lng: number } } | null | undefined,
  input?: WorkflowActionInput
): number | undefined {
  if (!stop?.location || !input?.gps) return undefined;
  return Math.round(
    haversineDistance(
      input.gps.lat,
      input.gps.lng,
      stop.location.lat,
      stop.location.lng
    )
  );
}

async function findExistingWorkflowAudit(companyId: string, clientEventId: string) {
  return RouteExecutionAudit.findOne({ companyId, clientEventId }).lean();
}

async function recordWorkflowAudit({
  companyId,
  execution,
  stopId,
  action,
  input,
  actor,
  source,
}: {
  companyId: string;
  execution: IRouteExecution;
  stopId?: string;
  action: RouteExecutionAuditAction;
  input?: WorkflowActionInput;
  actor?: ExecutionActor;
  source: WorkflowSource;
}) {
  const clientEventId = buildClientEventId(action, String(execution._id), stopId, input);
  const existing = await findExistingWorkflowAudit(companyId, clientEventId);
  if (existing) return existing;

  const stop = stopId ? execution.stops.id(stopId) : null;
  const distanceMeters = getDistanceMeters(stop, input);

  return RouteExecutionAudit.create({
    companyId,
    routeId: execution.routeId,
    executionId: execution._id,
    stopId,
    action,
    actorUserId: actor?.userId,
    driverId: execution.driverId,
    clientEventId,
    occurredAt: getOccurredAt(input),
    serverReceivedAt: new Date(),
    syncedAt: source === 'mobile_offline_sync' ? new Date() : undefined,
    source,
    gps: input?.gps
      ? {
          lat: input.gps.lat,
          lng: input.gps.lng,
          speed: input.gps.speed,
          heading: input.gps.heading,
          accuracy: input.gps.accuracy,
          recordedAt: getGpsRecordedAt(input),
        }
      : undefined,
    expectedLocation: stop?.location
      ? {
          lat: stop.location.lat,
          lng: stop.location.lng,
        }
      : undefined,
    distanceMeters,
    resolvedAddress: input?.resolvedAddress,
    notes: input?.notes,
    receiverName: input?.receiverName,
    photoKey: input?.photoKey,
    signatureKey: input?.signatureKey,
    metadata: input?.metadata,
  });
}

function emitWorkflowUpdate(
  companyId: string,
  execution: IRouteExecution,
  event: Parameters<typeof emitExecutionRealtimeUpdate>[1]['event'],
  stopId?: string
) {
  emitExecutionRealtimeUpdate(
    companyId,
    {
      event,
      executionId: String(execution._id),
      routeId: String(execution.routeId),
      driverId: String(execution.driverId),
      status: execution.status,
      stopId,
      scheduledTime: execution.scheduledTime,
      timestamp: new Date().toISOString(),
    },
    {
      driverEvent: SOCKET_EVENTS.DRIVER_ROUTE_UPDATED,
      driverIds: [String(execution.driverId)],
    }
  );
}

export async function listExecutions(
  companyId: string,
  filters: {
    date?: string;
    startDate?: string;
    endDate?: string;
    driverId?: string;
    status?: string;
    routeId?: string;
  },
  page: number,
  limit: number
) {
  const query: Record<string, unknown> = { companyId };

  if (filters.date) {
    const d = businessDateStringToUtcDate(filters.date);
    query.scheduledDate = d;
  } else if (filters.startDate && filters.endDate) {
    query.scheduledDate = {
      $gte: businessDateStringToUtcDate(filters.startDate),
      $lte: businessDateStringToUtcDate(filters.endDate),
    };
  }

  if (filters.driverId) query.driverId = filters.driverId;
  if (filters.status) query.status = filters.status;
  if (filters.routeId) query.routeId = filters.routeId;

  const skip = (page - 1) * limit;

  const [executions, total] = await Promise.all([
    RouteExecution.find(query)
      .select('-stops.podPhoto -stops.podSignature -__v')
      .populate('routeId', 'name scheduledTime')
      .populate('contractId', 'clientId slaMinutes')
      .populate('driverId', 'name phone')
      .populate('originalDriverId', 'name')
      .lean()
      .skip(skip)
      .limit(limit)
      .sort({ scheduledDate: -1, createdAt: -1 }),
    RouteExecution.countDocuments(query),
  ]);

  return { executions, total };
}

export async function getTodayExecutions(companyId: string, driverId?: string) {
  const today = getCurrentBusinessDate();

  const todayQuery: Record<string, unknown> = { companyId, scheduledDate: today };
  if (driverId) todayQuery.driverId = driverId;

  const todayResults = await RouteExecution.find(todayQuery)
    .select('-__v')
    .populate('routeId', 'name scheduledTime')
    .populate('contractId', 'clientId slaMinutes')
    .populate('driverId', 'name phone vehicleId isOnline currentLocation')
    .populate('stops.clientId', 'name address location type')
    .lean()
    .sort({ scheduledTime: 1 });

  // Also include any IN_PROGRESS execution from a previous day so a driver
  // who started a route yesterday (or earlier) is still tracked after a login.
  if (driverId) {
    const activeQuery = {
      companyId,
      driverId,
      status: 'IN_PROGRESS',
      scheduledDate: { $lt: today },
    };
    const activeFromPriorDays = await RouteExecution.find(activeQuery)
      .select('-__v')
      .populate('routeId', 'name scheduledTime')
      .populate('contractId', 'clientId slaMinutes')
      .populate('driverId', 'name phone vehicleId isOnline currentLocation')
      .populate('stops.clientId', 'name address location type')
      .lean();

    // Merge without duplicates (by id string comparison).
    const todayIds = new Set(todayResults.map((e) => String(e._id)));
    for (const e of activeFromPriorDays) {
      if (!todayIds.has(String(e._id))) {
        todayResults.unshift(e);
      }
    }
  }

  return todayResults;
}

export async function getExecution(companyId: string, executionId: string) {
  const execution = await RouteExecution.findOne({ companyId, _id: executionId })
    .select('-__v')
    .populate('routeId', 'name scheduledTime description')
    .populate('contractId', 'clientId slaMinutes')
    .populate('driverId', 'name phone vehicleId isOnline currentLocation')
    .populate('originalDriverId', 'name')
    .populate('stops.clientId', 'name address location type')
    .lean();
  if (!execution) throw new AppError(ApiErrorCode.EXECUTION_NOT_FOUND, 404);
  return execution;
}

export async function getExecutionAudits(companyId: string, executionId: string) {
  return RouteExecutionAudit.find({ companyId, executionId })
    .select('-__v')
    .populate('driverId', 'name phone')
    .populate('actorUserId', 'email role')
    .lean()
    .sort({ occurredAt: 1, createdAt: 1 });
}

export async function receiveRoute(
  companyId: string,
  executionId: string,
  input: WorkflowActionInput,
  actor?: ExecutionActor,
  source: WorkflowSource = 'mobile_online'
) {
  const existing = await findExistingWorkflowAudit(
    companyId,
    buildClientEventId('ROUTE_RECEIVED', executionId, undefined, input)
  );
  if (existing) return getExecution(companyId, executionId);

  const execution = await RouteExecution.findOne({ companyId, _id: executionId });
  if (!execution) throw new AppError(ApiErrorCode.EXECUTION_NOT_FOUND, 404);
  ensureExecutionActorAccess(execution, actor);

  if (['PENDING', 'ASSIGNED'].includes(execution.status)) {
    execution.status = 'ACCEPTED';
  }

  await recordWorkflowAudit({ companyId, execution, action: 'ROUTE_RECEIVED', input, actor, source });
  await execution.save();
  touchDashboard(companyId);
  emitWorkflowUpdate(companyId, execution, 'STATUS_CHANGED');
  return execution.toObject();
}

export async function setStopOnTheWay(
  companyId: string,
  executionId: string,
  stopId: string,
  input: WorkflowActionInput,
  actor?: ExecutionActor,
  source: WorkflowSource = 'mobile_online'
) {
  const existing = await findExistingWorkflowAudit(
    companyId,
    buildClientEventId('STOP_ON_THE_WAY', executionId, stopId, input)
  );
  if (existing) return getExecution(companyId, executionId);

  const execution = await RouteExecution.findOne({ companyId, _id: executionId });
  if (!execution) throw new AppError(ApiErrorCode.EXECUTION_NOT_FOUND, 404);
  ensureExecutionActorAccess(execution, actor);

  const stop = execution.stops.id(stopId);
  if (!stop) throw new AppError(ApiErrorCode.STOP_NOT_FOUND, 404);
  if (!['PENDING', 'ON_THE_WAY'].includes(stop.status)) {
    throw new AppError(ApiErrorCode.STOP_ALREADY_STATUS, 400, { status: stop.status });
  }

  const occurredAt = getOccurredAt(input);
  stop.status = 'ON_THE_WAY';
  stop.onTheWayAt = occurredAt;
  stop.startedAt = occurredAt;
  if (['PENDING', 'ASSIGNED', 'ACCEPTED'].includes(execution.status)) {
    execution.status = 'IN_PROGRESS';
  }
  if (!execution.actualStartTime) {
    execution.actualStartTime = occurredAt;
  }

  await recordWorkflowAudit({ companyId, execution, stopId, action: 'STOP_ON_THE_WAY', input, actor, source });
  syncExecutionLifecycle(execution);
  await execution.save();
  touchDashboard(companyId);
  emitWorkflowUpdate(companyId, execution, 'STOP_STARTED', stopId);
  return execution.toObject();
}

export async function workflowStopArrived(
  companyId: string,
  executionId: string,
  stopId: string,
  input: WorkflowActionInput,
  actor?: ExecutionActor,
  source: WorkflowSource = 'mobile_online'
) {
  const existing = await findExistingWorkflowAudit(
    companyId,
    buildClientEventId('STOP_ARRIVED', executionId, stopId, input)
  );
  if (existing) return getExecution(companyId, executionId);

  const execution = await RouteExecution.findOne({ companyId, _id: executionId });
  if (!execution) throw new AppError(ApiErrorCode.EXECUTION_NOT_FOUND, 404);
  ensureExecutionActorAccess(execution, actor);

  const stop = execution.stops.id(stopId);
  if (!stop) throw new AppError(ApiErrorCode.STOP_NOT_FOUND, 404);
  if (!['PENDING', 'ON_THE_WAY', 'ARRIVED'].includes(stop.status)) {
    throw new AppError(ApiErrorCode.STOP_ALREADY_STATUS, 400, { status: stop.status });
  }

  const occurredAt = getOccurredAt(input);
  const distanceMeters = getDistanceMeters(stop, input);
  stop.status = 'ARRIVED';
  stop.arrivedAt = occurredAt;
  if (input.gps) stop.arrivalLocation = { lat: input.gps.lat, lng: input.gps.lng };
  if (input.resolvedAddress) stop.arrivalAddress = input.resolvedAddress;
  if (distanceMeters !== undefined) stop.arrivalDistanceMeters = distanceMeters;

  await recordWorkflowAudit({ companyId, execution, stopId, action: 'STOP_ARRIVED', input, actor, source });
  syncExecutionLifecycle(execution);
  await execution.save();
  touchDashboard(companyId);
  emitWorkflowUpdate(companyId, execution, 'STOP_ARRIVED', stopId);
  return execution.toObject();
}

export async function workflowStopCollected(
  companyId: string,
  executionId: string,
  stopId: string,
  input: WorkflowActionInput,
  actor?: ExecutionActor,
  source: WorkflowSource = 'mobile_online'
) {
  const existing = await findExistingWorkflowAudit(
    companyId,
    buildClientEventId('STOP_COLLECTED', executionId, stopId, input)
  );
  if (existing) return getExecution(companyId, executionId);

  const execution = await RouteExecution.findOne({ companyId, _id: executionId });
  if (!execution) throw new AppError(ApiErrorCode.EXECUTION_NOT_FOUND, 404);
  ensureExecutionActorAccess(execution, actor);

  const stop = execution.stops.id(stopId);
  if (!stop) throw new AppError(ApiErrorCode.STOP_NOT_FOUND, 404);
  if (!['ON_THE_WAY', 'ARRIVED', 'IN_PROGRESS', 'COMPLETED'].includes(stop.status)) {
    throw new AppError(ApiErrorCode.STOP_MUST_BE_ARRIVED_OR_IN_PROGRESS, 400);
  }

  const completedAt = getOccurredAt(input);
  const distanceMeters = getDistanceMeters(stop, input);
  stop.status = 'COMPLETED';
  stop.completedAt = completedAt;
  if (!stop.arrivedAt && stop.status !== 'ARRIVED') {
    stop.arrivedAt = completedAt;
  }
  if (stop.arrivedAt) {
    stop.waitingTimeMinutes = calcWaitingMinutes(stop.arrivedAt, completedAt);
  }
  if (input.receiverName) stop.receiverName = input.receiverName;
  if (input.notes) stop.deliveryNotes = input.notes;
  if (input.photoKey) stop.podPhoto = input.photoKey;
  if (input.signatureKey) stop.podSignature = input.signatureKey;
  if (input.gps) stop.deliveryLocation = { lat: input.gps.lat, lng: input.gps.lng };
  if (input.resolvedAddress) stop.collectionAddress = input.resolvedAddress;
  if (distanceMeters !== undefined) stop.collectionDistanceMeters = distanceMeters;

  await recordWorkflowAudit({ companyId, execution, stopId, action: 'STOP_COLLECTED', input, actor, source });
  syncExecutionLifecycle(execution);
  await execution.save();
  touchDashboard(companyId);
  emitWorkflowUpdate(companyId, execution, 'STOP_COMPLETED', stopId);
  return execution.toObject();
}

export async function workflowStopSkipped(
  companyId: string,
  executionId: string,
  stopId: string,
  input: WorkflowActionInput,
  actor?: ExecutionActor,
  source: WorkflowSource = 'mobile_online'
) {
  const existing = await findExistingWorkflowAudit(
    companyId,
    buildClientEventId('STOP_SKIPPED', executionId, stopId, input)
  );
  if (existing) return getExecution(companyId, executionId);

  const execution = await RouteExecution.findOne({ companyId, _id: executionId });
  if (!execution) throw new AppError(ApiErrorCode.EXECUTION_NOT_FOUND, 404);
  ensureExecutionActorAccess(execution, actor);

  const stop = execution.stops.id(stopId);
  if (!stop) throw new AppError(ApiErrorCode.STOP_NOT_FOUND, 404);

  stop.status = 'SKIPPED';
  if (input.notes) stop.deliveryNotes = input.notes;

  await recordWorkflowAudit({ companyId, execution, stopId, action: 'STOP_SKIPPED', input, actor, source });
  syncExecutionLifecycle(execution);
  await execution.save();
  touchDashboard(companyId);
  emitWorkflowUpdate(companyId, execution, 'STOP_SKIPPED', stopId);
  return execution.toObject();
}

export async function workflowRouteCompleted(
  companyId: string,
  executionId: string,
  input: WorkflowActionInput,
  actor?: ExecutionActor,
  source: WorkflowSource = 'mobile_online'
) {
  const existing = await findExistingWorkflowAudit(
    companyId,
    buildClientEventId('ROUTE_COMPLETED', executionId, undefined, input)
  );
  if (existing) return getExecution(companyId, executionId);

  const execution = await RouteExecution.findOne({ companyId, _id: executionId });
  if (!execution) throw new AppError(ApiErrorCode.EXECUTION_NOT_FOUND, 404);
  ensureExecutionActorAccess(execution, actor);

  const allStopsResolved =
    execution.stops.length > 0 &&
    execution.stops.every((stop) => ['COMPLETED', 'SKIPPED'].includes(stop.status));
  if (!allStopsResolved) {
    throw new AppError(ApiErrorCode.VALIDATION_ERROR, 400, {
      reason: 'all_stops_must_be_resolved',
    });
  }

  const completedAt = getOccurredAt(input);
  execution.status = 'COMPLETED';
  execution.actualEndTime = completedAt;
  if (execution.actualStartTime) {
    execution.totalDurationMinutes = Math.max(
      0,
      Math.round((completedAt.getTime() - execution.actualStartTime.getTime()) / 60_000)
    );
  }

  await recordWorkflowAudit({ companyId, execution, action: 'ROUTE_COMPLETED', input, actor, source });
  await execution.save();
  touchDashboard(companyId);
  emitWorkflowUpdate(companyId, execution, 'STATUS_CHANGED');
  return execution.toObject();
}

export async function syncWorkflowEvents(
  companyId: string,
  events: WorkflowSyncEventInput[],
  actor?: ExecutionActor
) {
  const results = [];

  for (const event of events) {
    const input: WorkflowActionInput = {
      clientEventId: event.clientEventId,
      occurredAt: event.occurredAt,
      gps: event.gps,
      resolvedAddress: event.resolvedAddress,
      notes: event.notes,
      receiverName: event.receiverName,
      photoKey: event.photoKey,
      signatureKey: event.signatureKey,
      metadata: event.metadata,
    };

    if (event.action === 'ROUTE_RECEIVED') {
      results.push(await receiveRoute(companyId, event.executionId, input, actor, 'mobile_offline_sync'));
    } else if (event.action === 'STOP_ON_THE_WAY' && event.stopId) {
      results.push(await setStopOnTheWay(companyId, event.executionId, event.stopId, input, actor, 'mobile_offline_sync'));
    } else if (event.action === 'STOP_ARRIVED' && event.stopId) {
      results.push(await workflowStopArrived(companyId, event.executionId, event.stopId, input, actor, 'mobile_offline_sync'));
    } else if (event.action === 'STOP_COLLECTED' && event.stopId) {
      results.push(await workflowStopCollected(companyId, event.executionId, event.stopId, input, actor, 'mobile_offline_sync'));
    } else if (event.action === 'STOP_SKIPPED' && event.stopId) {
      results.push(await workflowStopSkipped(companyId, event.executionId, event.stopId, input, actor, 'mobile_offline_sync'));
    } else if (event.action === 'ROUTE_COMPLETED') {
      results.push(await workflowRouteCompleted(companyId, event.executionId, input, actor, 'mobile_offline_sync'));
    }
  }

  return { synced: results.length };
}

export async function updateExecutionStatus(
  companyId: string,
  executionId: string,
  data: UpdateExecutionStatusInput,
  actor?: ExecutionActor
) {
  const execution = await RouteExecution.findOne({ companyId, _id: executionId });
  if (!execution) throw new AppError(ApiErrorCode.EXECUTION_NOT_FOUND, 404);

  if (actor?.role === 'DRIVER') {
    ensureExecutionActorAccess(execution, actor);

    const allowedDriverStatuses: UpdateExecutionStatusInput['status'][] = ['IN_PROGRESS', 'COMPLETED'];
    if (!allowedDriverStatuses.includes(data.status)) {
      throw new AppError(ApiErrorCode.FORBIDDEN, 403);
    }

    if (data.status === 'COMPLETED') {
      const allStopsResolved =
        execution.stops.length > 0 &&
        execution.stops.every((stop) => ['COMPLETED', 'SKIPPED'].includes(stop.status));

      if (!allStopsResolved) {
        throw new AppError(ApiErrorCode.VALIDATION_ERROR, 400, {
          status: data.status,
          reason: 'all_stops_must_be_resolved',
        });
      }
    }
  }

  const update: Record<string, unknown> = { status: data.status };

  if (data.status === 'IN_PROGRESS' && !execution.actualStartTime) {
    update.actualStartTime = new Date();
  }

  if (data.status === 'COMPLETED' && !execution.actualEndTime) {
    const endTime = new Date();
    update.actualEndTime = endTime;
    if (execution.actualStartTime) {
      update.totalDurationMinutes = Math.round(
        (endTime.getTime() - execution.actualStartTime.getTime()) / 60_000
      );
    }
  }

  const updated = await RouteExecution.findByIdAndUpdate(
    executionId,
    { $set: update },
    { new: true }
  ).lean();

  touchDashboard(companyId);
  if (updated) {
    emitExecutionRealtimeUpdate(
      companyId,
      {
        event:
          data.status === 'CANCELLED'
            ? 'EXECUTION_CANCELLED'
            : data.status === 'COMPLETED'
              ? 'STATUS_CHANGED'
              : 'STATUS_CHANGED',
        executionId: String(updated._id),
        routeId: String(updated.routeId),
        driverId: String(updated.driverId),
        status: updated.status,
        scheduledTime: updated.scheduledTime,
        timestamp: new Date().toISOString(),
      },
      {
        driverEvent:
          data.status === 'CANCELLED'
            ? SOCKET_EVENTS.DRIVER_ROUTE_CANCELLED
            : SOCKET_EVENTS.DRIVER_ROUTE_UPDATED,
        driverIds: [String(updated.driverId)],
      }
    );
  }

  return updated;
}

export async function substituteDriver(
  companyId: string,
  executionId: string,
  data: SubstituteDriverInput
) {
  const execution = await RouteExecution.findOne({ companyId, _id: executionId });
  if (!execution) throw new AppError(ApiErrorCode.EXECUTION_NOT_FOUND, 404);

  if (['COMPLETED', 'CANCELLED'].includes(execution.status)) {
    throw new AppError(ApiErrorCode.EXECUTION_CANNOT_SUBSTITUTE, 400);
  }

  const previousDriverId = execution.driverId ? String(execution.driverId) : undefined;

  const updated = await RouteExecution.findByIdAndUpdate(
    executionId,
    {
      $set: {
        driverId: data.newDriverId,
        isSubstitution: true,
      },
    },
    { new: true }
  )
    .populate('driverId', 'name phone')
    .lean();

  touchDashboard(companyId);
  if (updated) {
    emitExecutionRealtimeUpdate(
      companyId,
      {
        event: 'DRIVER_SUBSTITUTED',
        executionId: String(updated._id),
        routeId:
          typeof updated.routeId === 'object' && updated.routeId !== null && '_id' in updated.routeId
            ? String(updated.routeId._id)
            : String(updated.routeId),
        driverId: data.newDriverId,
        previousDriverId,
        status: updated.status,
        scheduledTime: updated.scheduledTime,
        timestamp: new Date().toISOString(),
      },
      {
        driverEvent: SOCKET_EVENTS.DRIVER_ROUTE_ASSIGNED,
        driverIds: [data.newDriverId],
      }
    );

    if (previousDriverId && previousDriverId !== data.newDriverId) {
      emitExecutionRealtimeUpdate(
        companyId,
        {
          event: 'EXECUTION_CANCELLED',
          executionId: String(updated._id),
          routeId:
            typeof updated.routeId === 'object' && updated.routeId !== null && '_id' in updated.routeId
              ? String(updated.routeId._id)
              : String(updated.routeId),
          driverId: previousDriverId,
          previousDriverId,
          status: updated.status,
          scheduledTime: updated.scheduledTime,
          timestamp: new Date().toISOString(),
        },
        {
          driverEvent: SOCKET_EVENTS.DRIVER_ROUTE_CANCELLED,
          driverIds: [previousDriverId],
        }
      );
    }
  }
  return updated;
}

// ──────────────────────────────────────────
// Stop workflow
// ──────────────────────────────────────────

export async function setStopArrived(
  companyId: string,
  executionId: string,
  stopId: string,
  actor?: ExecutionActor
) {
  const execution = await RouteExecution.findOne({ companyId, _id: executionId });
  if (!execution) throw new AppError(ApiErrorCode.EXECUTION_NOT_FOUND, 404);
  ensureExecutionActorAccess(execution, actor);

  const stop = execution.stops.id(stopId);
  if (!stop) throw new AppError(ApiErrorCode.STOP_NOT_FOUND, 404);

  if (stop.status !== 'PENDING') {
    throw new AppError(ApiErrorCode.STOP_ALREADY_STATUS, 400, { status: stop.status });
  }

  stop.status = 'ARRIVED';
  stop.arrivedAt = new Date();
  syncExecutionLifecycle(execution);

  await execution.save();
  touchDashboard(companyId);
  emitExecutionRealtimeUpdate(
    companyId,
    {
      event: 'STOP_ARRIVED',
      executionId: String(execution._id),
      routeId: String(execution.routeId),
      driverId: String(execution.driverId),
      status: execution.status,
      stopId: stopId,
      scheduledTime: execution.scheduledTime,
      timestamp: new Date().toISOString(),
    },
    {
      driverEvent: SOCKET_EVENTS.DRIVER_ROUTE_UPDATED,
      driverIds: [String(execution.driverId)],
    }
  );
  return execution.toObject();
}

export async function setStopInProgress(
  companyId: string,
  executionId: string,
  stopId: string,
  actor?: ExecutionActor
) {
  const execution = await RouteExecution.findOne({ companyId, _id: executionId });
  if (!execution) throw new AppError(ApiErrorCode.EXECUTION_NOT_FOUND, 404);
  ensureExecutionActorAccess(execution, actor);

  const stop = execution.stops.id(stopId);
  if (!stop) throw new AppError(ApiErrorCode.STOP_NOT_FOUND, 404);

  if (stop.status !== 'ARRIVED') {
    throw new AppError(ApiErrorCode.STOP_MUST_BE_ARRIVED, 400);
  }

  stop.status = 'IN_PROGRESS';
  stop.startedAt = new Date();
  syncExecutionLifecycle(execution);

  await execution.save();
  touchDashboard(companyId);
  emitExecutionRealtimeUpdate(
    companyId,
    {
      event: 'STOP_STARTED',
      executionId: String(execution._id),
      routeId: String(execution.routeId),
      driverId: String(execution.driverId),
      status: execution.status,
      stopId,
      scheduledTime: execution.scheduledTime,
      timestamp: new Date().toISOString(),
    },
    {
      driverEvent: SOCKET_EVENTS.DRIVER_ROUTE_UPDATED,
      driverIds: [String(execution.driverId)],
    }
  );
  return execution.toObject();
}

export async function completeStop(
  companyId: string,
  executionId: string,
  stopId: string,
  data: CompleteStopInput,
  actor?: ExecutionActor
) {
  const execution = await RouteExecution.findOne({ companyId, _id: executionId });
  if (!execution) throw new AppError(ApiErrorCode.EXECUTION_NOT_FOUND, 404);
  ensureExecutionActorAccess(execution, actor);

  const stop = execution.stops.id(stopId);
  if (!stop) throw new AppError(ApiErrorCode.STOP_NOT_FOUND, 404);

  if (!['ARRIVED', 'IN_PROGRESS'].includes(stop.status)) {
    throw new AppError(ApiErrorCode.STOP_MUST_BE_ARRIVED_OR_IN_PROGRESS, 400);
  }

  const completedAt = new Date();
  stop.status = 'COMPLETED';
  stop.completedAt = completedAt;

  if (stop.arrivedAt) {
    stop.waitingTimeMinutes = calcWaitingMinutes(stop.arrivedAt, completedAt);
  }

  if (data.receiverName) stop.receiverName = data.receiverName;
  if (data.deliveryNotes) stop.deliveryNotes = data.deliveryNotes;
  if (data.deliveryLat !== undefined && data.deliveryLng !== undefined) {
    stop.deliveryLocation = { lat: data.deliveryLat, lng: data.deliveryLng };
  }

  syncExecutionLifecycle(execution);
  await execution.save();
  touchDashboard(companyId);
  emitExecutionRealtimeUpdate(
    companyId,
    {
      event: 'STOP_COMPLETED',
      executionId: String(execution._id),
      routeId: String(execution.routeId),
      driverId: String(execution.driverId),
      status: execution.status,
      stopId,
      scheduledTime: execution.scheduledTime,
      timestamp: new Date().toISOString(),
    },
    {
      driverEvent: SOCKET_EVENTS.DRIVER_ROUTE_UPDATED,
      driverIds: [String(execution.driverId)],
    }
  );
  return execution.toObject();
}

export async function skipStop(
  companyId: string,
  executionId: string,
  stopId: string,
  reason?: string,
  actor?: ExecutionActor
) {
  const execution = await RouteExecution.findOne({ companyId, _id: executionId });
  if (!execution) throw new AppError(ApiErrorCode.EXECUTION_NOT_FOUND, 404);
  ensureExecutionActorAccess(execution, actor);

  const stop = execution.stops.id(stopId);
  if (!stop) throw new AppError(ApiErrorCode.STOP_NOT_FOUND, 404);

  stop.status = 'SKIPPED';
  if (reason) stop.deliveryNotes = reason;

  syncExecutionLifecycle(execution);
  await execution.save();
  touchDashboard(companyId);
  emitExecutionRealtimeUpdate(
    companyId,
    {
      event: 'STOP_SKIPPED',
      executionId: String(execution._id),
      routeId: String(execution.routeId),
      driverId: String(execution.driverId),
      status: execution.status,
      stopId,
      scheduledTime: execution.scheduledTime,
      timestamp: new Date().toISOString(),
    },
    {
      driverEvent: SOCKET_EVENTS.DRIVER_ROUTE_UPDATED,
      driverIds: [String(execution.driverId)],
    }
  );
  return execution.toObject();
}

export async function savePodToStop(
  companyId: string,
  executionId: string,
  stopId: string,
  photoKey?: string,
  signatureKey?: string,
  actor?: ExecutionActor
) {
  const execution = await RouteExecution.findOne({ companyId, _id: executionId });
  if (!execution) throw new AppError(ApiErrorCode.EXECUTION_NOT_FOUND, 404);
  ensureExecutionActorAccess(execution, actor);

  if (execution.status === 'CANCELLED') {
    throw new AppError(ApiErrorCode.FORBIDDEN, 403);
  }

  const stop = execution.stops.id(stopId);
  if (!stop) throw new AppError(ApiErrorCode.STOP_NOT_FOUND, 404);

  if (!['ARRIVED', 'IN_PROGRESS', 'COMPLETED'].includes(stop.status)) {
    throw new AppError(ApiErrorCode.STOP_MUST_BE_ARRIVED_OR_IN_PROGRESS, 400);
  }

  if (photoKey) stop.podPhoto = photoKey;
  if (signatureKey) stop.podSignature = signatureKey;

  await execution.save();
  touchDashboard(companyId);
  emitExecutionRealtimeUpdate(
    companyId,
    {
      event: 'POD_SAVED',
      executionId: String(execution._id),
      routeId: String(execution.routeId),
      driverId: String(execution.driverId),
      status: execution.status,
      stopId,
      scheduledTime: execution.scheduledTime,
      timestamp: new Date().toISOString(),
    },
    {
      driverEvent: SOCKET_EVENTS.DRIVER_ROUTE_UPDATED,
      driverIds: [String(execution.driverId)],
    }
  );
  return stop;
}

export async function getExecutionGpsTrack(executionId: string) {
  return GpsPoint.find({ executionId })
    .select('location speed heading recordedAt -_id')
    .lean()
    .sort({ recordedAt: 1 });
}

export async function generateExecutionForDate(routeId: string, targetDate: Date | string) {
  const scheduledDate =
    typeof targetDate === 'string' ? businessDateStringToUtcDate(targetDate) : targetDate;
  const route = await Route.findById(routeId)
    .populate('defaultDriverId', '_id')
    .lean();

  if (!route || !route.isActive) return null;
  if (!route.defaultDriverId) return null;
  if (!routeRunsOnDate(route, scheduledDate)) return null;
  const existingExecution = await RouteExecution.findOne({
    routeId: route._id,
    scheduledDate,
  })
    .select('_id')
    .lean();
  if (existingExecution) return null;

  const executionData = {
    companyId: route.companyId,
    routeId: route._id,
    contractId: route.contractId,
    scheduledDate,
    scheduledTime: route.scheduledTime,
    driverId: route.defaultDriverId,
    originalDriverId: route.defaultDriverId,
    isSubstitution: false,
    status: 'PENDING',
    delayMinutes: 0,
    stops: route.stops.map((s, i) => ({
      routeStopIndex: i,
      clientId: s.clientId,
      order: s.order,
      address: s.address,
      location: s.location,
      plannedTime: s.plannedTime,
      expectedDurationMinutes: s.expectedDurationMinutes ?? 15,
      type: s.type,
      instructions: s.instructions,
      status: 'PENDING',
    })),
  };

  const execution = await RouteExecution.findOneAndUpdate(
    { routeId: route._id, scheduledDate },
    { $setOnInsert: executionData },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const normalizedDriverId =
    typeof route.defaultDriverId === 'object' && route.defaultDriverId !== null
      ? String(route.defaultDriverId._id)
      : String(route.defaultDriverId);

  emitExecutionRealtimeUpdate(
    String(route.companyId),
    {
      event: 'EXECUTION_ASSIGNED',
      executionId: String(execution._id),
      routeId: String(route._id),
      routeName: route.name,
      driverId: normalizedDriverId,
      status: execution.status,
      scheduledTime: execution.scheduledTime,
      timestamp: new Date().toISOString(),
    },
    {
      driverEvent: SOCKET_EVENTS.DRIVER_ROUTE_ASSIGNED,
      driverIds: [normalizedDriverId],
    }
  );

  return execution;
}

export async function generateExecutionsForDate(
  companyId: string,
  options: { date?: string; routeId?: string }
) {
  const businessDate = options.date ?? getCurrentBusinessDate();
  const scheduledDate =
    typeof businessDate === 'string' ? businessDateStringToUtcDate(businessDate) : businessDate;

  if (options.routeId) {
    const route = await Route.findOne({ _id: options.routeId, companyId }).select('_id').lean();
    if (!route) throw new AppError(ApiErrorCode.ROUTE_NOT_FOUND, 404);

    const execution = await generateExecutionForDate(options.routeId, scheduledDate);
    touchDashboard(companyId);

    return {
      date: toDateString(scheduledDate),
      generated: execution ? 1 : 0,
      routeId: options.routeId,
    };
  }

  const routes = await Route.find({
    companyId,
    isActive: true,
    isTemplate: false,
    defaultDriverId: { $ne: null },
  })
    .select('_id')
    .lean();

  let generated = 0;
  for (const route of routes) {
    const execution = await generateExecutionForDate(String(route._id), scheduledDate);
    if (execution) {
      generated += 1;
    }
  }

  touchDashboard(companyId);

  return {
    date: toDateString(scheduledDate),
    generated,
  };
}

export async function getExecutionAlerts(
  companyId: string,
  executionId: string,
  locale: 'pt' | 'es' | 'en'
) {
  const alerts = await Alert.find({ companyId, executionId }).lean().sort({ createdAt: -1 });
  return alerts.map((alert) => localizeAlertDocument(alert, locale));
}
