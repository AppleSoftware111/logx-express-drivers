import type { CreateRouteInput, UpdateRouteInput } from '@logx/shared';

import { ApiErrorCode } from '@logx/i18n';

import { AppError } from '../../middleware/errorHandler';
import { Client } from '../../models/Client.model';
import { Contract } from '../../models/Contract.model';
import { Driver } from '../../models/Driver.model';
import { Route } from '../../models/Route.model';
import { RouteExecution } from '../../models/RouteExecution.model';
import {
  addBusinessDays,
  businessDateStringToUtcDate,
  getCurrentBusinessDateString,
  routeRunsOnDate,
} from '../../utils/timeCalc';

function normalizeOptionalDate(value?: string | null): Date | null | undefined {
  if (value === undefined) return undefined;
  if (!value) return null;
  return businessDateStringToUtcDate(value);
}

type RouteRelationDraft = Partial<CreateRouteInput> & {
  clientId?: string | null;
  contractId?: string | null;
  defaultDriverId?: string | null;
  recurrenceStartDate?: string | null;
  recurrenceEndDate?: string | null;
};

async function ensureClientBelongsToCompany(companyId: string, clientId: string) {
  const client = await Client.findOne({ _id: clientId, companyId, isActive: true })
    .select('_id')
    .lean();
  if (!client) throw new AppError(ApiErrorCode.CLIENT_NOT_FOUND, 404);
}

async function validateRouteRelations(
  companyId: string,
  draft: RouteRelationDraft,
  currentRoute?: {
    clientId?: string | { toString(): string } | null;
    contractId?: string | { toString(): string } | null;
  } | null
): Promise<{ derivedClientId?: string }> {
  if (draft.defaultDriverId) {
    const driver = await Driver.findOne({ _id: draft.defaultDriverId, companyId, isActive: true })
      .select('_id')
      .lean();
    if (!driver) throw new AppError(ApiErrorCode.DRIVER_NOT_FOUND, 404);
  }

  if (draft.clientId) {
    await ensureClientBelongsToCompany(companyId, draft.clientId);
  }

  if (draft.stops?.length) {
    const stopClientIds = [...new Set(draft.stops.map((stop) => stop.clientId))];
    const clients = await Client.find({
      _id: { $in: stopClientIds },
      companyId,
      isActive: true,
    })
      .select('_id')
      .lean();

    if (clients.length !== stopClientIds.length) {
      throw new AppError(ApiErrorCode.CLIENT_NOT_FOUND, 404);
    }
  }

  const effectiveClientId =
    'clientId' in draft
      ? draft.clientId
      : currentRoute?.clientId
        ? String(currentRoute.clientId)
        : undefined;

  const effectiveContractId =
    'contractId' in draft
      ? draft.contractId
      : currentRoute?.contractId
        ? String(currentRoute.contractId)
        : undefined;

  if (!effectiveContractId) return {};

  const contract = await Contract.findOne({
    _id: effectiveContractId,
    companyId,
    isActive: true,
  })
    .select('clientId')
    .lean();

  if (!contract) throw new AppError(ApiErrorCode.CONTRACT_NOT_FOUND, 404);

  const contractClientId = String(contract.clientId);
  if (effectiveClientId === null) {
    throw new AppError(ApiErrorCode.VALIDATION_ERROR, 400);
  }

  if (effectiveClientId && effectiveClientId !== contractClientId) {
    throw new AppError(ApiErrorCode.VALIDATION_ERROR, 400);
  }

  if (!effectiveClientId) {
    return { derivedClientId: contractClientId };
  }

  return {};
}

export async function listRoutes(
  companyId: string,
  filters: {
    isActive?: boolean;
    isTemplate?: boolean;
    driverId?: string;
    clientId?: string;
  }
) {
  const query: Record<string, unknown> = { companyId };
  if (filters.isActive !== undefined) query.isActive = filters.isActive;
  if (filters.isTemplate !== undefined) query.isTemplate = filters.isTemplate;
  if (filters.driverId) query.defaultDriverId = filters.driverId;
  if (filters.clientId) {
    query.$or = [{ clientId: filters.clientId }, { 'stops.clientId': filters.clientId }];
  }

  return Route.find(query)
    .select('-__v')
    .populate('clientId', 'name type address')
    .populate('defaultDriverId', 'name phone')
    .populate('contractId', 'slaMinutes startDate endDate clientId')
    .populate('stops.clientId', 'name address type')
    .lean()
    .sort({ name: 1 });
}

export async function getRoute(companyId: string, routeId: string) {
  const route = await Route.findOne({ companyId, _id: routeId })
    .select('-__v')
    .populate('clientId', 'name address type location')
    .populate('defaultDriverId', 'name phone')
    .populate('contractId', 'slaMinutes startDate endDate clientId')
    .populate('stops.clientId', 'name address type location')
    .lean();
  if (!route) throw new AppError(ApiErrorCode.ROUTE_NOT_FOUND, 404);
  return route;
}

export async function createRoute(companyId: string, data: CreateRouteInput) {
  const relationState = await validateRouteRelations(companyId, data);

  const route = await Route.create({
    companyId,
    clientId: relationState.derivedClientId ?? data.clientId,
    contractId: data.contractId,
    name: data.name,
    description: data.description,
    recurrenceType: data.recurrenceType,
    daysOfWeek: data.daysOfWeek ?? [],
    dayOfMonth: data.dayOfMonth,
    monthOfYear: data.monthOfYear,
    recurrenceStartDate: normalizeOptionalDate(data.recurrenceStartDate),
    recurrenceEndDate: normalizeOptionalDate(data.recurrenceEndDate),
    scheduledTime: data.scheduledTime,
    isTemplate: data.isTemplate ?? false,
    defaultDriverId: data.defaultDriverId,
    stops: data.stops.map((s, i) => ({
      clientId: s.clientId,
      order: s.order ?? i,
      address: s.address,
      location: { lat: s.lat, lng: s.lng },
      plannedTime: s.plannedTime,
      expectedDurationMinutes: s.expectedDurationMinutes ?? 15,
      type: s.type,
      instructions: s.instructions,
    })),
  });
  return route.toObject();
}

export async function updateRoute(
  companyId: string,
  routeId: string,
  data: UpdateRouteInput
) {
  const draft = data as Partial<CreateRouteInput>;
  const currentRoute = await Route.findOne({ companyId, _id: routeId })
    .select('clientId contractId')
    .lean();
  if (!currentRoute) throw new AppError(ApiErrorCode.ROUTE_NOT_FOUND, 404);

  const relationState = await validateRouteRelations(companyId, draft, currentRoute);
  const update: Record<string, unknown> = {};

  if ('clientId' in data) {
    update.clientId = draft.clientId ?? relationState.derivedClientId ?? null;
  } else if (relationState.derivedClientId) {
    update.clientId = relationState.derivedClientId;
  }
  if (draft.name) update.name = draft.name;
  if (draft.description !== undefined) update.description = draft.description;
  if (draft.recurrenceType) update.recurrenceType = draft.recurrenceType;
  if ('daysOfWeek' in data) update.daysOfWeek = draft.daysOfWeek ?? [];
  if ('dayOfMonth' in data) update.dayOfMonth = draft.dayOfMonth ?? null;
  if ('monthOfYear' in data) update.monthOfYear = draft.monthOfYear ?? null;
  if ('recurrenceStartDate' in data) {
    update.recurrenceStartDate = normalizeOptionalDate(draft.recurrenceStartDate) ?? null;
  }
  if ('recurrenceEndDate' in data) {
    update.recurrenceEndDate = normalizeOptionalDate(draft.recurrenceEndDate) ?? null;
  }
  if (draft.scheduledTime) update.scheduledTime = draft.scheduledTime;
  if (draft.isTemplate !== undefined) update.isTemplate = draft.isTemplate;
  if ('defaultDriverId' in data) update.defaultDriverId = draft.defaultDriverId ?? null;
  if ('contractId' in data) update.contractId = draft.contractId ?? null;
  if (draft.stops) {
    update.stops = draft.stops.map((s, i) => ({
      clientId: s.clientId,
      order: s.order ?? i,
      address: s.address,
      location: { lat: s.lat, lng: s.lng },
      plannedTime: s.plannedTime,
      expectedDurationMinutes: s.expectedDurationMinutes ?? 15,
      type: s.type,
      instructions: s.instructions,
    }));
  }

  const nextRecurrenceType = draft.recurrenceType;
  if (nextRecurrenceType === 'DAILY') {
    update.daysOfWeek = [];
    update.dayOfMonth = null;
    update.monthOfYear = null;
  } else if (nextRecurrenceType === 'WEEKLY' || nextRecurrenceType === 'CUSTOM') {
    update.dayOfMonth = null;
    update.monthOfYear = null;
  } else if (nextRecurrenceType === 'MONTHLY') {
    update.monthOfYear = null;
  }

  const route = await Route.findOneAndUpdate(
    { companyId, _id: routeId },
    { $set: update },
    { new: true }
  ).lean();
  return route!;
}

export async function toggleRouteActive(companyId: string, routeId: string, isActive: boolean) {
  const route = await Route.findOneAndUpdate(
    { companyId, _id: routeId },
    { isActive },
    { new: true }
  ).lean();
  if (!route) throw new AppError(ApiErrorCode.ROUTE_NOT_FOUND, 404);
  return route;
}

export async function deleteRoute(companyId: string, routeId: string) {
  return toggleRouteActive(companyId, routeId, false);
}

/**
 * Preview the next N days of scheduled executions for a route (without creating them).
 */
export async function previewRouteSchedule(
  companyId: string,
  routeId: string,
  days = 7
): Promise<{
  routeStartTime: string;
  stops: Array<{
    order: number;
    plannedTime: string;
    address: string;
    clientName?: string;
    type: string;
  }>;
  days: Array<{
    date: string;
    willRun: boolean;
    hasExecution: boolean;
    executionId?: string;
    executionStatus?: string;
  }>;
}> {
  const route = await Route.findOne({ companyId, _id: routeId }).lean();
  if (!route) throw new AppError(ApiErrorCode.ROUTE_NOT_FOUND, 404);

  const today = getCurrentBusinessDateString();

  const preview = [];

  for (let i = 0; i < days; i++) {
    const dateStr = addBusinessDays(today, i);
    const willRun = routeRunsOnDate(route, dateStr);
    const scheduledDate = businessDateStringToUtcDate(dateStr);
    const existing = await RouteExecution.findOne({
      routeId,
      scheduledDate,
    })
      .select('_id status')
      .lean();

    preview.push({
      date: dateStr,
      willRun,
      hasExecution: !!existing,
      executionId: existing?._id?.toString(),
      executionStatus: existing?.status,
    });
  }

  const populatedRoute = await Route.findById(routeId)
    .populate('stops.clientId', 'name')
    .lean();

  return {
    routeStartTime: route.scheduledTime,
    stops:
      populatedRoute?.stops
        ?.slice()
        .sort((a, b) => a.order - b.order)
        .map((stop) => {
          const populatedClient =
            typeof stop.clientId === 'object' && stop.clientId
              ? (stop.clientId as { name?: string })
              : undefined;

          return {
            order: stop.order,
            plannedTime: stop.plannedTime,
            address: stop.address,
            clientName: populatedClient?.name,
            type: stop.type,
          };
        }) ?? [],
    days: preview,
  };
}
