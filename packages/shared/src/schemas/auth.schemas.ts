import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('validation.invalidEmail'),
  password: z.string().min(1, 'validation.passwordRequired'),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().optional(),
});

export const updateUserPreferencesSchema = z
  .object({
    locale: z.enum(['pt', 'es', 'en']).optional(),
  })
  .refine((data) => data.locale !== undefined, {
    message: 'validation.required',
    path: ['locale'],
  });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'validation.currentPasswordRequired'),
    newPassword: z
      .string()
      .min(8, 'validation.passwordMin')
      .regex(/[A-Z]/, 'validation.passwordUppercase')
      .regex(/[0-9]/, 'validation.passwordNumber'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'validation.passwordsDoNotMatch',
    path: ['confirmPassword'],
  });

export type LoginInput = z.infer<typeof loginSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type UpdateUserPreferencesInput = z.infer<typeof updateUserPreferencesSchema>;
