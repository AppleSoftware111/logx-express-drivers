import type {
  CompleteStopInput,
  SubstituteDriverInput,
  UpdateExecutionStatusInput,
} from '@logx/shared';

import { ApiErrorCode } from '@logx/i18n';

import { AppError } from '../../middleware/errorHandler';
import { Alert } from '../../models/Alert.model';
import { GpsPoint } from '../../models/GpsPoint.model';
import { Route } from '../../models/Route.model';
import { RouteExecution, type IRouteExecution } from '../../models/RouteExecution.model';
import { localizeAlertDocument } from '../alerts/alert.service';
import { invalidateCache } from '../../utils/cache';
import {
  businessDateStringToUtcDate,
  calcDelayMinutes,
  calcWaitingMinutes,
  getCurrentBusinessDate,
  routeRunsOnDate,
  toDateString,
} from '../../utils/timeCalc';

type ExecutionActor = {
  role: string;
  driverId?: string;
};

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
      .flatMap((stop) => [stop.arrivedAt, stop.startedAt, stop.completedAt])
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
        .flatMap((stop) => [stop.completedAt, stop.startedAt, stop.arrivedAt])
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

  const query: Record<string, unknown> = { companyId, scheduledDate: today };
  if (driverId) query.driverId = driverId;

  return RouteExecution.find(query)
    .select('-__v')
    .populate('routeId', 'name scheduledTime')
    .populate('contractId', 'clientId slaMinutes')
    .populate('driverId', 'name phone currentLocation')
    .populate('stops.clientId', 'name address location type')
    .lean()
    .sort({ scheduledTime: 1 });
}

export async function getExecution(companyId: string, executionId: string) {
  const execution = await RouteExecution.findOne({ companyId, _id: executionId })
    .select('-__v')
    .populate('routeId', 'name scheduledTime description')
    .populate('contractId', 'clientId slaMinutes')
    .populate('driverId', 'name phone vehicleId')
    .populate('originalDriverId', 'name')
    .populate('stops.clientId', 'name address location type')
    .lean();
  if (!execution) throw new AppError(ApiErrorCode.EXECUTION_NOT_FOUND, 404);
  return execution;
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

  const stop = execution.stops.id(stopId);
  if (!stop) throw new AppError(ApiErrorCode.STOP_NOT_FOUND, 404);

  if (photoKey) stop.podPhoto = photoKey;
  if (signatureKey) stop.podSignature = signatureKey;

  await execution.save();
  touchDashboard(companyId);
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
