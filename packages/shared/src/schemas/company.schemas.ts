import { z } from 'zod';

export const createCompanySchema = z.object({
  name: z.string().min(2, 'validation.nameMin'),
  cnpj: z
    .string()
    .regex(/^\d{14}$/, 'validation.cnpjDigits')
    .optional(),
  logo: z.string().url('validation.custom').optional(),
});

export const updateCompanySchema = createCompanySchema.partial();

export const createBranchSchema = z.object({
  name: z.string().min(2, 'validation.nameMin'),
  address: z.string().min(5, 'validation.addressMin'),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export const updateBranchSchema = createBranchSchema.partial();

export const createUserSchema = z.object({
  email: z.string().email('validation.invalidEmail'),
  password: z
    .string()
    .min(8, 'validation.passwordMin')
    .regex(/[A-Z]/, 'validation.passwordUppercase')
    .regex(/[0-9]/, 'validation.passwordNumber'),
  role: z.enum(['ADMIN', 'OPERATOR', 'CLIENT', 'DRIVER']),
  driverId: z.string().optional(),
  clientId: z.string().optional(),
});

export type CreateCompanyInput = z.infer<typeof createCompanySchema>;
export type UpdateCompanyInput = z.infer<typeof updateCompanySchema>;
export type CreateBranchInput = z.infer<typeof createBranchSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
