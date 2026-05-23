import { addDays, format } from 'date-fns';

import type { CreateRouteInput, UpdateRouteInput } from '@logx/shared';

import { AppError } from '../../middleware/errorHandler';
import { Route } from '../../models/Route.model';
import { RouteExecution } from '../../models/RouteExecution.model';
import { matchesDayOfWeek } from '../../utils/timeCalc';

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
  if (filters.clientId) query['stops.clientId'] = filters.clientId;

  return Route.find(query)
    .select('-__v')
    .populate('defaultDriverId', 'name phone')
    .populate('contractId', 'slaMinutes startDate endDate')
    .populate('stops.clientId', 'name address type')
    .lean()
    .sort({ name: 1 });
}

export async function getRoute(companyId: string, routeId: string) {
  const route = await Route.findOne({ companyId, _id: routeId })
    .select('-__v')
    .populate('defaultDriverId', 'name phone')
    .populate('contractId', 'slaMinutes startDate endDate')
    .populate('stops.clientId', 'name address type location')
    .lean();
  if (!route) throw new AppError('Route not found', 404);
  return route;
}

export async function createRoute(companyId: string, data: CreateRouteInput) {
  const route = await Route.create({
    companyId,
    contractId: data.contractId,
    name: data.name,
    description: data.description,
    recurrenceType: data.recurrenceType,
    daysOfWeek: data.daysOfWeek ?? [],
    scheduledTime: data.scheduledTime,
    isTemplate: data.isTemplate ?? false,
    defaultDriverId: data.defaultDriverId,
    stops: data.stops.map((s, i) => ({
      clientId: s.clientId,
      order: s.order ?? i,
      address: s.address,
      location: { lat: s.lat, lng: s.lng },
      expectedDurationMinutes: s.expectedDurationMinutes ?? 15,
      type: s.type,
    })),
  });
  return route.toObject();
}

export async function updateRoute(
  companyId: string,
  routeId: string,
  data: UpdateRouteInput
) {
  const update: Record<string, unknown> = {};

  if (data.name) update.name = data.name;
  if (data.description !== undefined) update.description = data.description;
  if (data.recurrenceType) update.recurrenceType = data.recurrenceType;
  if (data.daysOfWeek) update.daysOfWeek = data.daysOfWeek;
  if (data.scheduledTime) update.scheduledTime = data.scheduledTime;
  if (data.isTemplate !== undefined) update.isTemplate = data.isTemplate;
  if (data.defaultDriverId !== undefined) update.defaultDriverId = data.defaultDriverId;
  if (data.contractId !== undefined) update.contractId = data.contractId;
  if (data.stops) {
    update.stops = data.stops.map((s, i) => ({
      clientId: s.clientId,
      order: s.order ?? i,
      address: s.address,
      location: { lat: s.lat, lng: s.lng },
      expectedDurationMinutes: s.expectedDurationMinutes ?? 15,
      type: s.type,
    }));
  }

  const route = await Route.findOneAndUpdate(
    { companyId, _id: routeId },
    { $set: update },
    { new: true }
  ).lean();
  if (!route) throw new AppError('Route not found', 404);
  return route;
}

export async function toggleRouteActive(companyId: string, routeId: string, isActive: boolean) {
  const route = await Route.findOneAndUpdate(
    { companyId, _id: routeId },
    { isActive },
    { new: true }
  ).lean();
  if (!route) throw new AppError('Route not found', 404);
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
): Promise<{ date: string; willRun: boolean; hasExecution: boolean }[]> {
  const route = await Route.findOne({ companyId, _id: routeId }).lean();
  if (!route) throw new AppError('Route not found', 404);

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const preview = [];

  for (let i = 0; i < days; i++) {
    const date = addDays(today, i);
    const dateStr = format(date, 'yyyy-MM-dd');

    let willRun = false;
    if (route.recurrenceType === 'DAILY') {
      willRun = true;
    } else if (route.recurrenceType === 'WEEKLY') {
      willRun = matchesDayOfWeek(date, route.daysOfWeek);
    } else if (route.recurrenceType === 'MONTHLY') {
      willRun = date.getUTCDate() === new Date(today).getUTCDate();
    } else if (route.recurrenceType === 'CUSTOM') {
      willRun = matchesDayOfWeek(date, route.daysOfWeek);
    }

    const scheduledDate = new Date(dateStr);
    const existing = await RouteExecution.findOne({
      routeId,
      scheduledDate,
    })
      .select('_id status')
      .lean();

    preview.push({ date: dateStr, willRun, hasExecution: !!existing });
  }

  return preview;
}
