import { z } from 'zod';

const routeStopSchema = z.object({
  clientId: z.string().min(1),
  order: z.number().int().min(0),
  address: z.string().min(5, 'validation.addressMin'),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  expectedDurationMinutes: z.number().int().min(1).default(15),
  type: z.enum(['PICKUP', 'DELIVERY', 'BOTH']),
});

export const createRouteSchema = z.object({
  contractId: z.string().optional(),
  name: z.string().min(2, 'validation.routeNameMin'),
  description: z.string().optional(),
  recurrenceType: z.enum(['DAILY', 'WEEKLY', 'MONTHLY', 'CUSTOM']),
  daysOfWeek: z
    .array(z.number().int().min(0).max(6))
    .min(1, 'validation.daysRequired')
    .optional(),
  scheduledTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'validation.timeFormat'),
  isTemplate: z.boolean().default(false),
  defaultDriverId: z.string().optional(),
  stops: z.array(routeStopSchema).min(1, 'validation.stopsRequired'),
});

export const updateRouteSchema = createRouteSchema.partial();

export const reorderStopsSchema = z.object({
  stops: z.array(
    z.object({
      clientId: z.string(),
      order: z.number().int().min(0),
    })
  ),
});

export type RouteStopInput = z.infer<typeof routeStopSchema>;
export type CreateRouteInput = z.infer<typeof createRouteSchema>;
export type UpdateRouteInput = z.infer<typeof updateRouteSchema>;
