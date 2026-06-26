import type { RouteStopInput } from '@logx/shared';
import { SOCKET_EVENTS } from '@logx/shared';
import { ApiErrorCode } from '@logx/i18n';
import { Types } from 'mongoose';

import { AppError } from '../../middleware/errorHandler';
import { Route, type IRoute, type IRouteStop } from '../../models/Route.model';
import {
  RouteExecution,
  type IExecutionStop,
  type IRouteExecution,
} from '../../models/RouteExecution.model';
import { emitExecutionRealtimeUpdate } from '../../socket/realtime';
import {
  businessDateStringToUtcDate,
  getCurrentBusinessDate,
  getCurrentBusinessDateString,
  routeRunsOnDate,
} from '../../utils/timeCalc';
import { generateExecutionForDate, touchDashboard } from './execution.service';

export type CompletedTodayAction = 'keep' | 'create_follow_up';

export type RouteEditSyncOptions = {
  completedTodayAction?: CompletedTodayAction;
  followUpScheduledTime?: string;
  followUpLabel?: string;
};

export type RouteEditSyncPreview = {
  needsCompletedTodayPrompt: boolean;
  hasOpenExecution: boolean;
  hasCompletedExecution: boolean;
  openExecutionId?: string;
  completedRunCount: number;
  pendingNewStopCount: number;
  pendingNewStops: Array<{
    order: number;
    address: string;
    plannedTime: string;
    type: string;
  }>;
};

export type RouteEditSyncResult = {
  synced: number;
  generated: number;
  followUpCreated: number;
  skippedCompleted: number;
  executionIds: string[];
  action: 'synced_open' | 'generated' | 'follow_up_created' | 'kept_completed' | 'none';
};

const OPEN_EXECUTION_STATUSES = ['PENDING', 'ASSIGNED', 'ACCEPTED', 'IN_PROGRESS'] as const;
const TERMINAL_EXECUTION_STATUSES = ['COMPLETED', 'CANCELLED'] as const;
const TERMINAL_STOP_STATUSES = ['COMPLETED', 'SKIPPED'] as const;
const REMOVABLE_STOP_STATUSES = ['PENDING', 'ON_THE_WAY'] as const;

export function stopFingerprint(clientId: string, address: string): string {
  return `${clientId}:${address.trim().toLowerCase()}`;
}

function templateStopFingerprint(stop: IRouteStop | RouteStopInput, index: number): string {
  const clientId =
    typeof stop.clientId === 'object' && stop.clientId !== null
      ? String(stop.clientId)
      : String(stop.clientId);
  const address = 'address' in stop ? stop.address : '';
  return stopFingerprint(clientId, address || `index:${index}`);
}

function isTerminalStopStatus(status: string): boolean {
  return TERMINAL_STOP_STATUSES.includes(status as (typeof TERMINAL_STOP_STATUSES)[number]);
}

function isRemovableStopStatus(status: string): boolean {
  return REMOVABLE_STOP_STATUSES.includes(status as (typeof REMOVABLE_STOP_STATUSES)[number]);
}

function toPlainStop(stop: IExecutionStop): IExecutionStop {
  const maybeDoc = stop as unknown as { toObject?: () => IExecutionStop };
  return typeof maybeDoc.toObject === 'function' ? maybeDoc.toObject() : { ...stop };
}

function mapTemplateStopToExecutionStop(
  stop: IRouteStop,
  routeStopIndex: number,
  status = 'PENDING'
): Omit<IExecutionStop, '_id'> {
  return {
    routeStopIndex,
    clientId: stop.clientId,
    order: stop.order ?? routeStopIndex,
    address: stop.address,
    location: {
      lat: stop.location?.lat ?? 0,
      lng: stop.location?.lng ?? 0,
    },
    plannedTime: stop.plannedTime,
    expectedDurationMinutes: stop.expectedDurationMinutes ?? 15,
    type: stop.type,
    instructions: stop.instructions,
    status,
  };
}

export function collectCompletedStopFingerprints(executions: IRouteExecution[]): Set<string> {
  const keys = new Set<string>();
  for (const execution of executions) {
    for (const stop of execution.stops) {
      if (stop.status === 'COMPLETED') {
        keys.add(stopFingerprint(String(stop.clientId), stop.address));
      }
    }
  }
  return keys;
}

export function computeDeltaStops(
  route: Pick<IRoute, 'stops'>,
  completedFingerprints: Set<string>
): Array<{ stop: IRouteStop; routeStopIndex: number }> {
  return route.stops
    .map((stop, routeStopIndex) => ({ stop, routeStopIndex }))
    .filter(({ stop, routeStopIndex }) => {
      return !completedFingerprints.has(templateStopFingerprint(stop, routeStopIndex));
    });
}

export async function getExecutionsForRouteDate(
  companyId: string,
  routeId: string,
  scheduledDate: Date
): Promise<IRouteExecution[]> {
  return RouteExecution.find({ companyId, routeId, scheduledDate })
    .sort({ runSeq: 1 })
    .exec();
}

function findMatchingExecutionStop(
  execution: IRouteExecution,
  routeStopIndex: number,
  templateStop: IRouteStop
): IExecutionStop | undefined {
  const byIndex = execution.stops.find((s) => s.routeStopIndex === routeStopIndex);
  if (byIndex) return byIndex;

  const clientId = String(templateStop.clientId);
  return execution.stops.find(
    (s) =>
      String(s.clientId) === clientId &&
      s.order === (templateStop.order ?? routeStopIndex) &&
      !isTerminalStopStatus(s.status)
  );
}

function mergeOpenExecutionStops(
  execution: IRouteExecution,
  route: IRoute
): { stops: IExecutionStop[]; changed: boolean } {
  const matchedStopIds = new Set<string>();
  const merged: IExecutionStop[] = [];
  let changed = false;

  for (let routeStopIndex = 0; routeStopIndex < route.stops.length; routeStopIndex += 1) {
    const templateStop = route.stops[routeStopIndex];
    const existing = findMatchingExecutionStop(execution, routeStopIndex, templateStop);

    if (existing) {
      matchedStopIds.add(String(existing._id));
      if (isTerminalStopStatus(existing.status)) {
        merged.push(existing);
        continue;
      }

      const existingPlain = toPlainStop(existing);
      const updated = {
        ...existingPlain,
        routeStopIndex,
        order: templateStop.order ?? routeStopIndex,
        address: templateStop.address,
        location: {
          lat: templateStop.location?.lat ?? existing.location.lat,
          lng: templateStop.location?.lng ?? existing.location.lng,
        },
        plannedTime: templateStop.plannedTime,
        expectedDurationMinutes: templateStop.expectedDurationMinutes ?? 15,
        type: templateStop.type,
        instructions: templateStop.instructions,
      } as IExecutionStop;

      if (JSON.stringify(updated) !== JSON.stringify(existingPlain)) {
        changed = true;
      }
      merged.push(updated);
      continue;
    }

    changed = true;
    merged.push({
      ...mapTemplateStopToExecutionStop(templateStop, routeStopIndex),
      _id: new Types.ObjectId(),
    } as IExecutionStop);
  }

  for (const existing of execution.stops) {
    const id = String(existing._id);
    if (matchedStopIds.has(id)) continue;

    if (isRemovableStopStatus(existing.status)) {
      changed = true;
      merged.push({
        ...toPlainStop(existing),
        status: 'SKIPPED',
      } as IExecutionStop);
      continue;
    }

    merged.push(existing);
  }

  if (merged.length !== execution.stops.length) {
    changed = true;
  }

  return { stops: merged, changed };
}

function emitDriverRouteUpdated(execution: IRouteExecution, companyId: string): void {
  emitExecutionRealtimeUpdate(
    companyId,
    {
      event: 'EXECUTION_UPDATED',
      executionId: String(execution._id),
      routeId: String(execution.routeId),
      driverId: String(execution.driverId),
      status: execution.status,
      scheduledTime: execution.scheduledTime,
      timestamp: new Date().toISOString(),
    },
    {
      driverEvent: SOCKET_EVENTS.DRIVER_ROUTE_UPDATED,
      driverIds: [String(execution.driverId)],
    }
  );
}

function emitDriverRouteAssigned(
  execution: IRouteExecution,
  companyId: string,
  routeName: string
): void {
  emitExecutionRealtimeUpdate(
    companyId,
    {
      event: 'EXECUTION_ASSIGNED',
      executionId: String(execution._id),
      routeId: String(execution.routeId),
      routeName,
      driverId: String(execution.driverId),
      status: execution.status,
      scheduledTime: execution.scheduledTime,
      timestamp: new Date().toISOString(),
    },
    {
      driverEvent: SOCKET_EVENTS.DRIVER_ROUTE_ASSIGNED,
      driverIds: [String(execution.driverId)],
    }
  );
}

export async function syncOpenExecutionsFromRoute(
  companyId: string,
  route: IRoute
): Promise<{ syncedExecutionIds: string[] }> {
  const today = getCurrentBusinessDate();
  const openExecutions = await RouteExecution.find({
    companyId,
    routeId: route._id,
    status: { $in: [...OPEN_EXECUTION_STATUSES] },
    scheduledDate: { $gte: today },
  }).exec();

  const syncedExecutionIds: string[] = [];

  for (const execution of openExecutions) {
    const { stops, changed } = mergeOpenExecutionStops(execution, route);
    let executionChanged = changed;

    if (execution.scheduledTime !== route.scheduledTime) {
      execution.scheduledTime = route.scheduledTime;
      executionChanged = true;
    }

    if (route.contractId && String(execution.contractId ?? '') !== String(route.contractId)) {
      execution.contractId = route.contractId;
      executionChanged = true;
    }

    if (
      execution.status !== 'IN_PROGRESS' &&
      route.defaultDriverId &&
      String(execution.driverId) !== String(route.defaultDriverId)
    ) {
      execution.driverId = route.defaultDriverId;
      execution.originalDriverId = route.defaultDriverId;
      executionChanged = true;
    }

    if (!executionChanged) continue;

    execution.stops = stops as typeof execution.stops;
    execution.markModified('stops');
    await execution.save();
    syncedExecutionIds.push(String(execution._id));
    emitDriverRouteUpdated(execution, companyId);
  }

  if (syncedExecutionIds.length > 0) {
    touchDashboard(companyId);
  }

  return { syncedExecutionIds };
}

export async function createFollowUpExecutionForDate(
  companyId: string,
  route: IRoute,
  scheduledDate: Date,
  options: { followUpScheduledTime?: string; followUpLabel?: string; sourceExecutionId?: string }
): Promise<IRouteExecution> {
  if (!route.defaultDriverId) {
    throw new AppError(ApiErrorCode.VALIDATION_ERROR, 400);
  }

  const existingExecutions = await getExecutionsForRouteDate(
    companyId,
    String(route._id),
    scheduledDate
  );

  const hasCompleted = existingExecutions.some((e) =>
    TERMINAL_EXECUTION_STATUSES.includes(e.status as (typeof TERMINAL_EXECUTION_STATUSES)[number])
  );
  if (!hasCompleted) {
    throw new AppError(ApiErrorCode.EXECUTION_CANNOT_CREATE_FOLLOW_UP, 400);
  }

  const hasOpen = existingExecutions.some((e) =>
    OPEN_EXECUTION_STATUSES.includes(e.status as (typeof OPEN_EXECUTION_STATUSES)[number])
  );
  if (hasOpen) {
    throw new AppError(ApiErrorCode.EXECUTION_OPEN_ALREADY_EXISTS, 400);
  }

  const completedFingerprints = collectCompletedStopFingerprints(existingExecutions);
  const deltaStops = computeDeltaStops(route, completedFingerprints);

  if (!deltaStops.length) {
    throw new AppError(ApiErrorCode.NO_NEW_STOPS_FOR_FOLLOW_UP, 400);
  }

  const maxRunSeq = existingExecutions.reduce((max, e) => Math.max(max, e.runSeq ?? 1), 0);
  const runSeq = maxRunSeq + 1;
  const sourceExecution =
    existingExecutions.find((e) => e.status === 'COMPLETED') ?? existingExecutions[0];

  const execution = await RouteExecution.create({
    companyId: route.companyId,
    routeId: route._id,
    contractId: route.contractId,
    scheduledDate,
    scheduledTime: options.followUpScheduledTime ?? route.scheduledTime,
    runSeq,
    runLabel: options.followUpLabel ?? `Run ${runSeq}`,
    sourceExecutionId: options.sourceExecutionId ?? sourceExecution?._id,
    driverId: route.defaultDriverId,
    originalDriverId: route.defaultDriverId,
    isSubstitution: false,
    status: 'PENDING',
    delayMinutes: 0,
    stops: deltaStops.map(({ stop, routeStopIndex }) =>
      mapTemplateStopToExecutionStop(stop, routeStopIndex, 'PENDING')
    ),
  });

  emitDriverRouteAssigned(execution, companyId, route.name);
  touchDashboard(companyId);

  return execution;
}

export async function previewRouteEditSync(
  companyId: string,
  routeId: string,
  proposedStops?: RouteStopInput[]
): Promise<RouteEditSyncPreview> {
  const route = await Route.findOne({ companyId, _id: routeId }).lean();
  if (!route) throw new AppError(ApiErrorCode.ROUTE_NOT_FOUND, 404);

  const todayStr = getCurrentBusinessDateString();
  const scheduledDate = businessDateStringToUtcDate(todayStr);
  const executions = await getExecutionsForRouteDate(companyId, routeId, scheduledDate);

  const routeForPreview = proposedStops
    ? ({
        ...route,
        stops: proposedStops.map((s, i) => ({
          clientId: s.clientId as unknown as IRouteStop['clientId'],
          order: s.order ?? i,
          address: s.address,
          location: { lat: s.lat, lng: s.lng },
          plannedTime: s.plannedTime,
          expectedDurationMinutes: s.expectedDurationMinutes ?? 15,
          type: s.type,
          instructions: s.instructions,
        })),
      } as unknown as IRoute)
    : (route as unknown as IRoute);

  const openExecutions = executions.filter((e) =>
    OPEN_EXECUTION_STATUSES.includes(e.status as (typeof OPEN_EXECUTION_STATUSES)[number])
  );
  const completedExecutions = executions.filter((e) =>
    TERMINAL_EXECUTION_STATUSES.includes(e.status as (typeof TERMINAL_EXECUTION_STATUSES)[number])
  );

  const completedFingerprints = collectCompletedStopFingerprints(executions);
  const deltaStops = computeDeltaStops(routeForPreview, completedFingerprints);

  return {
    needsCompletedTodayPrompt: completedExecutions.length > 0 && openExecutions.length === 0 && deltaStops.length > 0,
    hasOpenExecution: openExecutions.length > 0,
    hasCompletedExecution: completedExecutions.length > 0,
    openExecutionId: openExecutions[0] ? String(openExecutions[0]._id) : undefined,
    completedRunCount: completedExecutions.length,
    pendingNewStopCount: deltaStops.length,
    pendingNewStops: deltaStops.map(({ stop, routeStopIndex }) => ({
      order: stop.order ?? routeStopIndex,
      address: stop.address,
      plannedTime: stop.plannedTime,
      type: stop.type,
    })),
  };
}

export async function applyRouteEditSync(
  companyId: string,
  routeId: string,
  options: RouteEditSyncOptions = {}
): Promise<RouteEditSyncResult> {
  const route = await Route.findOne({ companyId, _id: routeId }).exec();
  if (!route) throw new AppError(ApiErrorCode.ROUTE_NOT_FOUND, 404);

  const today = getCurrentBusinessDate();
  const todayStr = getCurrentBusinessDateString();
  const scheduledDate = businessDateStringToUtcDate(todayStr);
  const executionsToday = await getExecutionsForRouteDate(companyId, routeId, scheduledDate);

  const openExecutions = executionsToday.filter((e) =>
    OPEN_EXECUTION_STATUSES.includes(e.status as (typeof OPEN_EXECUTION_STATUSES)[number])
  );

  if (openExecutions.length > 0) {
    const { syncedExecutionIds } = await syncOpenExecutionsFromRoute(companyId, route);
    return {
      synced: syncedExecutionIds.length,
      generated: 0,
      followUpCreated: 0,
      skippedCompleted: 0,
      executionIds: syncedExecutionIds,
      action: 'synced_open',
    };
  }

  if (executionsToday.length === 0 && routeRunsOnDate(route, today)) {
    const generated = await generateExecutionForDate(String(route._id), scheduledDate);
    if (generated) {
      return {
        synced: 0,
        generated: 1,
        followUpCreated: 0,
        skippedCompleted: 0,
        executionIds: [String(generated._id)],
        action: 'generated',
      };
    }
  }

  const hasCompletedToday = executionsToday.some((e) =>
    TERMINAL_EXECUTION_STATUSES.includes(e.status as (typeof TERMINAL_EXECUTION_STATUSES)[number])
  );

  if (hasCompletedToday) {
    const completedFingerprints = collectCompletedStopFingerprints(executionsToday);
    const deltaStops = computeDeltaStops(route, completedFingerprints);

    if (deltaStops.length > 0 && options.completedTodayAction === 'create_follow_up') {
      const followUp = await createFollowUpExecutionForDate(companyId, route, scheduledDate, {
        followUpScheduledTime: options.followUpScheduledTime,
        followUpLabel: options.followUpLabel,
      });
      return {
        synced: 0,
        generated: 0,
        followUpCreated: 1,
        skippedCompleted: 0,
        executionIds: [String(followUp._id)],
        action: 'follow_up_created',
      };
    }

    if (deltaStops.length > 0) {
      return {
        synced: 0,
        generated: 0,
        followUpCreated: 0,
        skippedCompleted: executionsToday.length,
        executionIds: [],
        action: 'kept_completed',
      };
    }
  }

  return {
    synced: 0,
    generated: 0,
    followUpCreated: 0,
    skippedCompleted: 0,
    executionIds: [],
    action: 'none',
  };
}
