import { z } from 'zod';

export const updateExecutionStatusSchema = z.object({
  status: z.enum(['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']),
});

export const substituteDriverSchema = z.object({
  newDriverId: z.string().min(1, 'Driver ID is required'),
});

export const updateStopStatusSchema = z.object({
  status: z.enum(['ARRIVED', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED']),
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
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
    .optional(),
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

export type UpdateExecutionStatusInput = z.infer<typeof updateExecutionStatusSchema>;
export type SubstituteDriverInput = z.infer<typeof substituteDriverSchema>;
export type UpdateStopStatusInput = z.infer<typeof updateStopStatusSchema>;
export type CompleteStopInput = z.infer<typeof completeStopSchema>;
export type GpsPointInput = z.infer<typeof gpsPointSchema>;
