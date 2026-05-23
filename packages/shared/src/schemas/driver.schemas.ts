import { z } from 'zod';

export const createDriverSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  phone: z
    .string()
    .regex(/^\+?[1-9]\d{7,14}$/, 'Invalid phone number')
    .optional(),
  cpf: z
    .string()
    .regex(/^\d{11}$/, 'CPF must be 11 digits')
    .optional(),
  licenseNumber: z.string().optional(),
  vehicleId: z.string().optional(),
  createUserAccount: z.boolean().default(false),
  email: z.string().email().optional(),
  password: z.string().min(8).optional(),
});

export const updateDriverSchema = createDriverSchema.omit({ createUserAccount: true }).partial();

export const createVehicleSchema = z.object({
  plate: z
    .string()
    .min(7, 'Plate must be at least 7 characters')
    .max(8)
    .toUpperCase(),
  model: z.string().min(2),
  year: z.number().int().min(1990).max(new Date().getFullYear() + 1),
  type: z.enum(['CAR', 'MOTORCYCLE', 'VAN', 'TRUCK']),
});

export const updateVehicleSchema = createVehicleSchema.partial();

export type CreateDriverInput = z.infer<typeof createDriverSchema>;
export type UpdateDriverInput = z.infer<typeof updateDriverSchema>;
export type CreateVehicleInput = z.infer<typeof createVehicleSchema>;
export type UpdateVehicleInput = z.infer<typeof updateVehicleSchema>;
