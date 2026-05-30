import { z } from 'zod';

export const reportQuerySchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'validation.dateFormat'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'validation.dateFormat'),
  driverId: z.string().optional(),
  clientId: z.string().optional(),
  format: z.enum(['json', 'csv', 'pdf']).default('json'),
});

export type ReportQueryInput = z.infer<typeof reportQuerySchema>;
