import type {
  CompleteStopInput,
  SubstituteDriverInput,
  UpdateExecutionStatusInput,
  UpdateStopStatusInput,
} from '@logx/shared';

import { AppError } from '../../middleware/errorHandler';
import { Alert } from '../../models/Alert.model';
import { GpsPoint } from '../../models/GpsPoint.model';
import { Route } from '../../models/Route.model';
import { RouteExecution } from '../../models/RouteExecution.model';
import { invalidateCache } from '../../utils/cache';
import { calcWaitingMinutes } from '../../utils/timeCalc';

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
    const d = new Date(filters.date);
    query.scheduledDate = d;
  } else if (filters.startDate && filters.endDate) {
    query.scheduledDate = {
      $gte: new Date(filters.startDate),
      $lte: new Date(filters.endDate),
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
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const query: Record<string, unknown> = { companyId, scheduledDate: today };
  if (driverId) query.driverId = driverId;

  return RouteExecution.find(query)
    .select('-__v')
    .populate('routeId', 'name scheduledTime')
    .populate('driverId', 'name phone currentLocation')
    .populate('stops.clientId', 'name address location type')
    .lean()
    .sort({ scheduledTime: 1 });
}

export async function getExecution(companyId: string, executionId: string) {
  const execution = await RouteExecution.findOne({ companyId, _id: executionId })
    .select('-__v')
    .populate('routeId', 'name scheduledTime description')
    .populate('driverId', 'name phone vehicleId')
    .populate('originalDriverId', 'name')
    .populate('stops.clientId', 'name address location type')
    .lean();
  if (!execution) throw new AppError('Execution not found', 404);
  return execution;
}

export async function updateExecutionStatus(
  companyId: string,
  executionId: string,
  data: UpdateExecutionStatusInput
) {
  const execution = await RouteExecution.findOne({ companyId, _id: executionId });
  if (!execution) throw new AppError('Execution not found', 404);

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

  // Invalidate dashboard cache so the next request reflects the new status
  void invalidateCache(`dashboard:summary:${companyId}:*`);

  return updated;
}

export async function substituteDriver(
  companyId: string,
  executionId: string,
  data: SubstituteDriverInput
) {
  const execution = await RouteExecution.findOne({ companyId, _id: executionId });
  if (!execution) throw new AppError('Execution not found', 404);

  if (['COMPLETED', 'CANCELLED'].includes(execution.status)) {
    throw new AppError('Cannot substitute driver on a completed or cancelled execution', 400);
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

  return updated;
}

// ──────────────────────────────────────────
// Stop workflow
// ──────────────────────────────────────────

export async function setStopArrived(
  companyId: string,
  executionId: string,
  stopId: string
) {
  const execution = await RouteExecution.findOne({ companyId, _id: executionId });
  if (!execution) throw new AppError('Execution not found', 404);

  const stop = execution.stops.id(stopId);
  if (!stop) throw new AppError('Stop not found', 404);

  if (stop.status !== 'PENDING') {
    throw new AppError(`Stop is already in status: ${stop.status}`, 400);
  }

  stop.status = 'ARRIVED';
  stop.arrivedAt = new Date();

  await execution.save();
  return execution.toObject();
}

export async function setStopInProgress(
  companyId: string,
  executionId: string,
  stopId: string
) {
  const execution = await RouteExecution.findOne({ companyId, _id: executionId });
  if (!execution) throw new AppError('Execution not found', 404);

  const stop = execution.stops.id(stopId);
  if (!stop) throw new AppError('Stop not found', 404);

  if (stop.status !== 'ARRIVED') {
    throw new AppError('Stop must be in ARRIVED status before starting', 400);
  }

  stop.status = 'IN_PROGRESS';
  stop.startedAt = new Date();

  await execution.save();
  return execution.toObject();
}

export async function completeStop(
  companyId: string,
  executionId: string,
  stopId: string,
  data: CompleteStopInput
) {
  const execution = await RouteExecution.findOne({ companyId, _id: executionId });
  if (!execution) throw new AppError('Execution not found', 404);

  const stop = execution.stops.id(stopId);
  if (!stop) throw new AppError('Stop not found', 404);

  if (!['ARRIVED', 'IN_PROGRESS'].includes(stop.status)) {
    throw new AppError('Stop must be ARRIVED or IN_PROGRESS to complete', 400);
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

  await execution.save();
  return execution.toObject();
}

export async function skipStop(
  companyId: string,
  executionId: string,
  stopId: string,
  reason?: string
) {
  const execution = await RouteExecution.findOne({ companyId, _id: executionId });
  if (!execution) throw new AppError('Execution not found', 404);

  const stop = execution.stops.id(stopId);
  if (!stop) throw new AppError('Stop not found', 404);

  stop.status = 'SKIPPED';
  if (reason) stop.deliveryNotes = reason;

  await execution.save();
  return execution.toObject();
}

export async function savePodToStop(
  companyId: string,
  executionId: string,
  stopId: string,
  photoKey?: string,
  signatureKey?: string
) {
  const execution = await RouteExecution.findOne({ companyId, _id: executionId });
  if (!execution) throw new AppError('Execution not found', 404);

  const stop = execution.stops.id(stopId);
  if (!stop) throw new AppError('Stop not found', 404);

  if (photoKey) stop.podPhoto = photoKey;
  if (signatureKey) stop.podSignature = signatureKey;

  await execution.save();
  return stop;
}

export async function getExecutionGpsTrack(executionId: string) {
  return GpsPoint.find({ executionId })
    .select('location speed heading recordedAt -_id')
    .lean()
    .sort({ recordedAt: 1 });
}

export async function generateExecutionForDate(routeId: string, targetDate: Date) {
  const route = await Route.findById(routeId)
    .populate('defaultDriverId', '_id')
    .lean();

  if (!route || !route.isActive) return null;
  if (!route.defaultDriverId) return null;

  const executionData = {
    companyId: route.companyId,
    routeId: route._id,
    contractId: route.contractId,
    scheduledDate: targetDate,
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
      type: s.type,
      status: 'PENDING',
    })),
  };

  const execution = await RouteExecution.findOneAndUpdate(
    { routeId: route._id, scheduledDate: targetDate },
    { $setOnInsert: executionData },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return execution;
}

export async function getExecutionAlerts(companyId: string, executionId: string) {
  return Alert.find({ companyId, executionId }).lean().sort({ createdAt: -1 });
}
