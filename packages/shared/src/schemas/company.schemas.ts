import { z } from 'zod';

export const createCompanySchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  cnpj: z
    .string()
    .regex(/^\d{14}$/, 'CNPJ must be 14 digits (numbers only)')
    .optional(),
  logo: z.string().url('Logo must be a valid URL').optional(),
});

export const updateCompanySchema = createCompanySchema.partial();

export const createBranchSchema = z.object({
  name: z.string().min(2),
  address: z.string().min(5),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export const updateBranchSchema = createBranchSchema.partial();

export const createUserSchema = z.object({
  email: z.string().email(),
  password: z
    .string()
    .min(8)
    .regex(/[A-Z]/, 'Must contain uppercase')
    .regex(/[0-9]/, 'Must contain number'),
  role: z.enum(['ADMIN', 'OPERATOR', 'CLIENT', 'DRIVER']),
  driverId: z.string().optional(),
  clientId: z.string().optional(),
});

export type CreateCompanyInput = z.infer<typeof createCompanySchema>;
export type UpdateCompanyInput = z.infer<typeof updateCompanySchema>;
export type CreateBranchInput = z.infer<typeof createBranchSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
