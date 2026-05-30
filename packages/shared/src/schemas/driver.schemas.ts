import { z } from 'zod';

export const createDriverSchema = z.object({
  name: z.string().min(2, 'validation.nameMin'),
  phone: z
    .string()
    .regex(/^\+?[1-9]\d{7,14}$/, 'validation.invalidPhone')
    .optional(),
  cpf: z
    .string()
    .regex(/^\d{11}$/, 'validation.cpfDigits')
    .optional(),
  licenseNumber: z.string().optional(),
  vehicleId: z.string().optional(),
  createUserAccount: z.boolean().default(false),
  email: z.string().email('validation.invalidEmail').optional(),
  password: z.string().min(8, 'validation.passwordMin').optional(),
});

export const updateDriverSchema = createDriverSchema.omit({ createUserAccount: true }).partial();

export const createVehicleSchema = z.object({
  plate: z
    .string()
    .min(7, 'validation.plateMin')
    .max(8)
    .toUpperCase(),
  model: z.string().min(2, 'validation.nameMin'),
  year: z.number().int().min(1990).max(new Date().getFullYear() + 1),
  type: z.enum(['CAR', 'MOTORCYCLE', 'VAN', 'TRUCK']),
});

export const updateVehicleSchema = createVehicleSchema.partial();

export type CreateDriverInput = z.infer<typeof createDriverSchema>;
export type UpdateDriverInput = z.infer<typeof updateDriverSchema>;
export type CreateVehicleInput = z.infer<typeof createVehicleSchema>;
export type UpdateVehicleInput = z.infer<typeof updateVehicleSchema>;
