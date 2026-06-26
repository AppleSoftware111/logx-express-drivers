import { z } from 'zod';

const routeStopSchema = z.object({
  clientId: z.string().min(1),
  order: z.number().int().min(0),
  address: z.string().min(5, 'validation.addressMin'),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  plannedTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'validation.timeFormat'),
  expectedDurationMinutes: z.number().int().min(1).default(15),
  type: z.enum(['PICKUP', 'DELIVERY', 'BOTH']),
  instructions: z.string().trim().max(500).optional(),
});

const clearableIdSchema = z.union([z.string().min(1), z.null()]);
const clearableDateSchema = z
  .union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'validation.dateFormat'), z.null()]);

const createRouteSchemaBase = z.object({
  clientId: z.string().optional(),
  contractId: z.string().optional(),
  name: z.string().min(2, 'validation.routeNameMin'),
  description: z.string().optional(),
  recurrenceType: z.enum(['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY', 'CUSTOM']),
  daysOfWeek: z
    .array(z.number().int().min(0).max(6))
    .optional(),
  dayOfMonth: z.number().int().min(1).max(31).optional(),
  monthOfYear: z.number().int().min(1).max(12).optional(),
  recurrenceStartDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'validation.dateFormat')
    .optional(),
  recurrenceEndDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'validation.dateFormat')
    .optional(),
  scheduledTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'validation.timeFormat'),
  isTemplate: z.boolean().default(false),
  defaultDriverId: z.string().optional(),
  stops: z.array(routeStopSchema).min(1, 'validation.stopsRequired'),
});

export const createRouteSchema = createRouteSchemaBase.superRefine((data, ctx) => {
  if (data.recurrenceType === 'WEEKLY' || data.recurrenceType === 'CUSTOM') {
    if (!data.daysOfWeek?.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'validation.daysRequired',
        path: ['daysOfWeek'],
      });
    }
  }

  if (data.recurrenceType === 'MONTHLY' && !data.dayOfMonth) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'validation.dayOfMonthRequired',
      path: ['dayOfMonth'],
    });
  }

  if (data.recurrenceType === 'YEARLY') {
    if (!data.dayOfMonth) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'validation.dayOfMonthRequired',
        path: ['dayOfMonth'],
      });
    }
    if (!data.monthOfYear) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'validation.monthOfYearRequired',
        path: ['monthOfYear'],
      });
    }
  }

  if (data.recurrenceStartDate && data.recurrenceEndDate) {
    const start = new Date(`${data.recurrenceStartDate}T00:00:00Z`);
    const end = new Date(`${data.recurrenceEndDate}T00:00:00Z`);
    if (start.getTime() > end.getTime()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'validation.recurrenceEndDateAfterStart',
        path: ['recurrenceEndDate'],
      });
    }
  }
});

export const updateRouteSchemaBase = createRouteSchemaBase
  .extend({
    clientId: clearableIdSchema.optional(),
    contractId: clearableIdSchema.optional(),
    defaultDriverId: clearableIdSchema.optional(),
    recurrenceStartDate: clearableDateSchema.optional(),
    recurrenceEndDate: clearableDateSchema.optional(),
    completedTodayAction: z.enum(['keep', 'create_follow_up']).optional(),
    followUpScheduledTime: z
      .string()
      .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'validation.timeFormat')
      .optional(),
    followUpLabel: z.string().trim().max(100).optional(),
  })
  .partial();

export const updateRouteSchema = updateRouteSchemaBase.superRefine((data, ctx) => {
  if ((data.recurrenceType === 'WEEKLY' || data.recurrenceType === 'CUSTOM') && data.daysOfWeek) {
    if (!data.daysOfWeek.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'validation.daysRequired',
        path: ['daysOfWeek'],
      });
    }
  }

  if (data.recurrenceType === 'MONTHLY' && data.dayOfMonth === undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'validation.dayOfMonthRequired',
      path: ['dayOfMonth'],
    });
  }

  if (data.recurrenceType === 'YEARLY') {
    if (data.dayOfMonth === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'validation.dayOfMonthRequired',
        path: ['dayOfMonth'],
      });
    }
    if (data.monthOfYear === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'validation.monthOfYearRequired',
        path: ['monthOfYear'],
      });
    }
  }

  if (
    typeof data.recurrenceStartDate === 'string' &&
    typeof data.recurrenceEndDate === 'string'
  ) {
    const start = new Date(`${data.recurrenceStartDate}T00:00:00Z`);
    const end = new Date(`${data.recurrenceEndDate}T00:00:00Z`);
    if (start.getTime() > end.getTime()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'validation.recurrenceEndDateAfterStart',
        path: ['recurrenceEndDate'],
      });
    }
  }
});

export const reorderStopsSchema = z.object({
  stops: z.array(
    z.object({
      clientId: z.string(),
      order: z.number().int().min(0),
    })
  ),
});

export const routeEditSyncPreviewSchema = z.object({
  stops: z.array(routeStopSchema).optional(),
});

export type RouteStopInput = z.infer<typeof routeStopSchema>;
export type CreateRouteInput = z.infer<typeof createRouteSchema>;
export type UpdateRouteInput = z.infer<typeof updateRouteSchema>;
export type RouteEditSyncPreviewInput = z.infer<typeof routeEditSyncPreviewSchema>;
export type CompletedTodayAction = 'keep' | 'create_follow_up';
