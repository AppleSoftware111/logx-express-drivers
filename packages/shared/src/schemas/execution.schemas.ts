import { z } from 'zod';

export const updateExecutionStatusSchema = z.object({
  status: z.enum(['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']),
});

export const substituteDriverSchema = z.object({
  newDriverId: z.string().min(1, 'validation.driverIdRequired'),
});

export const updateStopStatusSchema = z.object({
  status: z.enum(['ON_THE_WAY', 'ARRIVED', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED']),
});

export const completeStopSchema = z.object({
  receiverName: z.string().min(1).optional(),
  deliveryNotes: z.string().optional(),
  deliveryLat: z.number().optional(),
  deliveryLng: z.number().optional(),
});

export const generateExecutionsSchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'validation.dateFormat')
    .optional(),
  routeId: z.string().min(1).optional(),
});

export const gpsPointSchema = z.object({
  driverId: z.string().min(1),
  executionId: z.string().min(1),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  speed: z.number().min(0).optional(),
  heading: z.number().min(0).max(360).optional(),
  accuracy: z.number().min(0).optional(),
  recordedAt: z.string().datetime({ offset: true }),
});

export const workflowGpsSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  speed: z.number().min(0).optional(),
  heading: z.number().min(0).max(360).optional(),
  accuracy: z.number().min(0).optional(),
  recordedAt: z.string().datetime({ offset: true }).optional(),
});

export const workflowActionSchema = z.object({
  clientEventId: z.string().min(1),
  occurredAt: z.string().datetime({ offset: true }).optional(),
  gps: workflowGpsSchema.optional(),
  resolvedAddress: z.string().optional(),
  notes: z.string().optional(),
  receiverName: z.string().optional(),
  photoKey: z.string().optional(),
  signatureKey: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const workflowSyncEventSchema = workflowActionSchema.extend({
  action: z.enum([
    'ROUTE_RECEIVED',
    'STOP_ON_THE_WAY',
    'STOP_ARRIVED',
    'STOP_COLLECTED',
    'ROUTE_COMPLETED',
    'STOP_SKIPPED',
  ]),
  executionId: z.string().min(1),
  stopId: z.string().min(1).optional(),
});

export const workflowSyncSchema = z.object({
  events: z.array(workflowSyncEventSchema).min(1).max(100),
});

export type UpdateExecutionStatusInput = z.infer<typeof updateExecutionStatusSchema>;
export type SubstituteDriverInput = z.infer<typeof substituteDriverSchema>;
export type UpdateStopStatusInput = z.infer<typeof updateStopStatusSchema>;
export type CompleteStopInput = z.infer<typeof completeStopSchema>;
export type GpsPointInput = z.infer<typeof gpsPointSchema>;
export type WorkflowGpsInput = z.infer<typeof workflowGpsSchema>;
export type WorkflowActionInput = z.infer<typeof workflowActionSchema>;
export type WorkflowSyncEventInput = z.infer<typeof workflowSyncEventSchema>;
export type WorkflowSyncInput = z.infer<typeof workflowSyncSchema>;
