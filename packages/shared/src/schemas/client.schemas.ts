import { z } from 'zod';

export const createClientSchema = z.object({
  name: z.string().min(2),
  cnpj: z
    .string()
    .regex(/^\d{14}$/, 'CNPJ must be 14 digits')
    .optional(),
  address: z.string().min(5),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  type: z.enum(['HOSPITAL', 'LABORATORY', 'OTHER']),
  createPortalUser: z.boolean().default(false),
  portalEmail: z.string().email().optional(),
  portalPassword: z.string().min(8).optional(),
});

export const updateClientSchema = createClientSchema
  .omit({ createPortalUser: true, portalEmail: true, portalPassword: true })
  .partial();

export const createContractSchema = z.object({
  clientId: z.string().min(1),
  startDate: z.string().datetime({ offset: true }),
  endDate: z.string().datetime({ offset: true }),
  slaMinutes: z.number().int().min(1).default(30),
});

export const updateContractSchema = createContractSchema.partial();

export type CreateClientInput = z.infer<typeof createClientSchema>;
export type UpdateClientInput = z.infer<typeof updateClientSchema>;
export type CreateContractInput = z.infer<typeof createContractSchema>;
export type UpdateContractInput = z.infer<typeof updateContractSchema>;
