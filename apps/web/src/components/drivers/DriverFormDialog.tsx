'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import type { CreateDriverInput, UpdateDriverInput } from '@logx/shared';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { getApiErrorMessage } from '@/lib/apiError';

const driverFormSchema = z
  .object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    phone: z.string().optional(),
    cpf: z.string().optional(),
    licenseNumber: z.string().optional(),
    vehicleId: z.string().optional(),
    createUserAccount: z.boolean().default(false),
    email: z.string().optional(),
    password: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.phone?.trim()) {
      const digits = data.phone.replace(/\D/g, '');
      if (digits.length < 10 || digits.length > 15) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Enter a valid phone number (10–15 digits)',
          path: ['phone'],
        });
      }
    }
    if (data.cpf?.trim()) {
      const digits = data.cpf.replace(/\D/g, '');
      if (digits.length !== 11) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'CPF must be 11 digits',
          path: ['cpf'],
        });
      }
    }
    if (data.createUserAccount) {
      if (!data.email?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Email is required for mobile app access',
          path: ['email'],
        });
      } else if (!z.string().email().safeParse(data.email).success) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Invalid email address',
          path: ['email'],
        });
      }
      if (!data.password || data.password.length < 8) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Password must be at least 8 characters',
          path: ['password'],
        });
      }
    }
  });

type DriverFormValues = z.infer<typeof driverFormSchema>;

export interface DriverFormInitial {
  _id: string;
  name: string;
  phone?: string;
  cpf?: string;
  licenseNumber?: string;
  vehicleId?: string | { _id: string };
}

interface VehicleOption {
  _id: string;
  plate: string;
  model: string;
  type: string;
}

interface DriverFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'edit';
  initial?: DriverFormInitial | null;
  vehicles: VehicleOption[];
  isSubmitting: boolean;
  submitError: unknown;
  onSubmit: (payload: CreateDriverInput | UpdateDriverInput) => void;
}

function normalizePayload(values: DriverFormValues): CreateDriverInput | UpdateDriverInput {
  const phoneDigits = values.phone?.replace(/\D/g, '');
  const cpfDigits = values.cpf?.replace(/\D/g, '');

  const base = {
    name: values.name.trim(),
    phone: phoneDigits && phoneDigits.length >= 10 ? phoneDigits : undefined,
    cpf: cpfDigits && cpfDigits.length === 11 ? cpfDigits : undefined,
    licenseNumber: values.licenseNumber?.trim() || undefined,
    vehicleId: values.vehicleId || undefined,
  };

  if (values.createUserAccount) {
    return {
      ...base,
      createUserAccount: true,
      email: values.email?.trim().toLowerCase(),
      password: values.password,
    } as CreateDriverInput;
  }

  return base;
}

function getVehicleId(vehicleId?: string | { _id: string }): string {
  if (!vehicleId) return '';
  return typeof vehicleId === 'string' ? vehicleId : vehicleId._id;
}

export function DriverFormDialog({
  open,
  onOpenChange,
  mode,
  initial,
  vehicles,
  isSubmitting,
  submitError,
  onSubmit,
}: DriverFormDialogProps) {
  const isEdit = mode === 'edit';

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<DriverFormValues>({
    resolver: zodResolver(driverFormSchema),
    defaultValues: {
      name: '',
      phone: '',
      cpf: '',
      licenseNumber: '',
      vehicleId: '',
      createUserAccount: false,
      email: '',
      password: '',
    },
  });

  const createUserAccount = watch('createUserAccount');

  useEffect(() => {
    if (!open) return;

    if (isEdit && initial) {
      reset({
        name: initial.name,
        phone: initial.phone ?? '',
        cpf: initial.cpf ?? '',
        licenseNumber: initial.licenseNumber ?? '',
        vehicleId: getVehicleId(initial.vehicleId),
        createUserAccount: false,
        email: '',
        password: '',
      });
    } else {
      reset({
        name: '',
        phone: '',
        cpf: '',
        licenseNumber: '',
        vehicleId: '',
        createUserAccount: false,
        email: '',
        password: '',
      });
    }
  }, [open, isEdit, initial, reset]);

  const handleFormSubmit = (values: DriverFormValues) => {
    const payload = normalizePayload(values);
    if (isEdit) {
      const { createUserAccount: _c, email: _e, password: _p, ...updatePayload } =
        payload as CreateDriverInput;
      onSubmit(updatePayload);
      return;
    }
    onSubmit(payload as CreateDriverInput);
  };

  const inputClass =
    'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent';
  const labelClass = 'block text-sm font-medium text-gray-700 mb-1';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit driver' : 'Add driver'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Update driver profile and vehicle assignment.'
              : 'Register a new driver. Optionally create a mobile app login.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
          <div>
            <label className={labelClass}>Full name *</label>
            <input
              {...register('name')}
              className={inputClass}
              placeholder="João Silva"
              autoFocus
            />
            {errors.name && (
              <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Phone</label>
              <input
                {...register('phone')}
                className={inputClass}
                placeholder="(11) 99999-9999"
              />
              {errors.phone && (
                <p className="mt-1 text-xs text-red-600">{errors.phone.message}</p>
              )}
            </div>
            <div>
              <label className={labelClass}>CPF</label>
              <input
                {...register('cpf')}
                className={inputClass}
                placeholder="00000000000"
                maxLength={14}
              />
              {errors.cpf && (
                <p className="mt-1 text-xs text-red-600">{errors.cpf.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>License number</label>
              <input
                {...register('licenseNumber')}
                className={inputClass}
                placeholder="CNH / license"
              />
            </div>
            <div>
              <label className={labelClass}>Vehicle</label>
              <select {...register('vehicleId')} className={inputClass}>
                <option value="">No vehicle assigned</option>
                {vehicles.map((v) => (
                  <option key={v._id} value={v._id}>
                    {v.plate} — {v.model} ({v.type})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {!isEdit && (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  {...register('createUserAccount')}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-800">
                  Create mobile app login
                </span>
              </label>
              <p className="text-xs text-gray-500">
                Allows the driver to sign in on the LOGX driver app to view routes and send GPS.
              </p>

              {createUserAccount && (
                <div className="grid grid-cols-1 gap-3 pt-1">
                  <div>
                    <label className={labelClass}>Email *</label>
                    <input
                      {...register('email')}
                      type="email"
                      className={inputClass}
                      placeholder="driver@company.com"
                      autoComplete="off"
                    />
                    {errors.email && (
                      <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>
                    )}
                  </div>
                  <div>
                    <label className={labelClass}>Password *</label>
                    <input
                      {...register('password')}
                      type="password"
                      className={inputClass}
                      placeholder="Min. 8 characters"
                      autoComplete="new-password"
                    />
                    {errors.password && (
                      <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {submitError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700">
                {getApiErrorMessage(submitError, 'Failed to save driver')}
              </p>
            </div>
          )}

          <DialogFooter>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving…
                </>
              ) : isEdit ? (
                'Save changes'
              ) : (
                'Create driver'
              )}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
