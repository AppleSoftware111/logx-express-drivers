'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import type { CreateRouteInput, UpdateRouteInput } from '@logx/shared';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  RouteStopsEditor,
  type ClientOption,
  type RouteFormValues,
  type RouteStopRow,
} from '@/components/routes/RouteStopsEditor';
import { getApiErrorMessage } from '@/lib/apiError';

const DAY_OPTIONS = [
  { value: 0, label: 'Sun' },
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
];

const routeFormSchema = z
  .object({
    name: z.string().min(2, 'Route name must be at least 2 characters'),
    description: z.string().optional(),
    scheduledTime: z
      .string()
      .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Use HH:mm format (e.g. 08:30)"),
    recurrenceType: z.enum(['DAILY', 'WEEKLY', 'MONTHLY', 'CUSTOM']),
    daysOfWeek: z.array(z.number().int().min(0).max(6)),
    isTemplate: z.boolean(),
    defaultDriverId: z.string().optional(),
    contractId: z.string().optional(),
    stops: z
      .array(
        z.object({
          clientId: z.string().min(1, 'Select a client'),
          order: z.number(),
          address: z.string().min(5, 'Address required'),
          lat: z.string(),
          lng: z.string(),
          expectedDurationMinutes: z.coerce.number().int().min(1),
          type: z.enum(['PICKUP', 'DELIVERY', 'BOTH']),
        })
      )
      .min(1, 'Add at least one stop'),
  })
  .superRefine((data, ctx) => {
    if (data.recurrenceType === 'WEEKLY' || data.recurrenceType === 'CUSTOM') {
      if (!data.daysOfWeek.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Select at least one day of the week',
          path: ['daysOfWeek'],
        });
      }
    }
    data.stops.forEach((stop, i) => {
      const lat = parseCoord(stop.lat);
      const lng = parseCoord(stop.lng);
      if (lat === null || lng === null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Client must have a mapped location',
          path: ['stops', i, 'clientId'],
        });
      }
    });
  });

interface DriverOption {
  _id: string;
  name: string;
}

interface ContractOption {
  _id: string;
  clientId?: { name: string };
  slaMinutes?: number;
}

interface RouteFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'edit';
  initial?: RouteFormValues | null;
  loadingInitial?: boolean;
  clients: ClientOption[];
  drivers: DriverOption[];
  contracts: ContractOption[];
  isSubmitting: boolean;
  submitError: unknown;
  onSubmit: (payload: CreateRouteInput | UpdateRouteInput) => void;
}

function parseCoord(value?: string): number | null {
  if (!value) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizeScheduledTime(time: string): string {
  const match = time.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return time;
  const h = match[1].padStart(2, '0');
  const m = match[2];
  return `${h}:${m}`;
}

function normalizePayload(values: RouteFormValues): CreateRouteInput {
  return {
    name: values.name.trim(),
    description: values.description?.trim() || undefined,
    scheduledTime: normalizeScheduledTime(values.scheduledTime),
    recurrenceType: values.recurrenceType,
    daysOfWeek:
      values.recurrenceType === 'WEEKLY' || values.recurrenceType === 'CUSTOM'
        ? values.daysOfWeek
        : [],
    isTemplate: values.isTemplate,
    defaultDriverId: values.defaultDriverId || undefined,
    contractId: values.contractId || undefined,
    stops: values.stops.map((s, i) => ({
      clientId: s.clientId,
      order: i,
      address: s.address.trim(),
      lat: parseCoord(s.lat)!,
      lng: parseCoord(s.lng)!,
      expectedDurationMinutes: s.expectedDurationMinutes,
      type: s.type,
    })),
  };
}

export function routeDetailToFormValues(route: {
  name: string;
  description?: string;
  scheduledTime: string;
  recurrenceType: string;
  daysOfWeek: number[];
  isTemplate: boolean;
  defaultDriverId?: string | { _id: string };
  contractId?: string | { _id: string };
  stops: Array<{
    clientId: string | { _id: string };
    order: number;
    address: string;
    location: { lat: number; lng: number };
    expectedDurationMinutes: number;
    type: string;
  }>;
}): RouteFormValues {
  const driverId =
    typeof route.defaultDriverId === 'object' && route.defaultDriverId
      ? route.defaultDriverId._id
      : (route.defaultDriverId as string | undefined);
  const contractId =
    typeof route.contractId === 'object' && route.contractId
      ? route.contractId._id
      : (route.contractId as string | undefined);

  return {
    name: route.name,
    description: route.description ?? '',
    scheduledTime: route.scheduledTime,
    recurrenceType: route.recurrenceType as RouteFormValues['recurrenceType'],
    daysOfWeek: route.daysOfWeek ?? [],
    isTemplate: route.isTemplate ?? false,
    defaultDriverId: driverId ?? '',
    contractId: contractId ?? '',
    stops: route.stops.map((s) => ({
      clientId: typeof s.clientId === 'object' ? s.clientId._id : s.clientId,
      order: s.order,
      address: s.address,
      lat: String(s.location.lat),
      lng: String(s.location.lng),
      expectedDurationMinutes: s.expectedDurationMinutes ?? 15,
      type: s.type as RouteStopRow['type'],
    })),
  };
}

const defaultValues: RouteFormValues = {
  name: '',
  description: '',
  scheduledTime: '08:00',
  recurrenceType: 'WEEKLY',
  daysOfWeek: [1, 2, 3, 4, 5],
  isTemplate: false,
  defaultDriverId: '',
  contractId: '',
  stops: [
    {
      clientId: '',
      order: 0,
      address: '',
      lat: '',
      lng: '',
      expectedDurationMinutes: 15,
      type: 'DELIVERY',
    },
  ],
};

export function RouteFormDialog({
  open,
  onOpenChange,
  mode,
  initial,
  loadingInitial,
  clients,
  drivers,
  contracts,
  isSubmitting,
  submitError,
  onSubmit,
}: RouteFormDialogProps) {
  const isEdit = mode === 'edit';

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    control,
    formState: { errors },
  } = useForm<RouteFormValues>({
    resolver: zodResolver(routeFormSchema),
    defaultValues,
  });

  const recurrenceType = watch('recurrenceType');
  const daysOfWeek = watch('daysOfWeek');
  const showDayPicker = recurrenceType === 'WEEKLY' || recurrenceType === 'CUSTOM';

  useEffect(() => {
    if (!open) return;
    if (isEdit && initial) {
      reset(initial);
    } else if (!isEdit) {
      reset(defaultValues);
    }
  }, [open, isEdit, initial, reset]);

  const toggleDay = (day: number) => {
    const next = daysOfWeek.includes(day)
      ? daysOfWeek.filter((d) => d !== day)
      : [...daysOfWeek, day].sort((a, b) => a - b);
    setValue('daysOfWeek', next);
  };

  const handleFormSubmit = (values: RouteFormValues) => {
    onSubmit(normalizePayload(values));
  };

  const inputClass =
    'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent';
  const labelClass = 'block text-sm font-medium text-gray-700 mb-1';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px] max-h-[92vh]">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit route' : 'New route'}</DialogTitle>
          <DialogDescription>
            Define schedule, recurrence, and ordered stops. Daily executions are generated
            automatically at midnight.
          </DialogDescription>
        </DialogHeader>

        {loadingInitial ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : (
          <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className={labelClass}>Route name *</label>
                <input
                  {...register('name')}
                  className={inputClass}
                  placeholder="Morning lab collection"
                  autoFocus
                />
                {errors.name && (
                  <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>
                )}
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass}>Description</label>
                <textarea
                  {...register('description')}
                  rows={2}
                  className={inputClass}
                  placeholder="Optional notes for operators"
                />
              </div>
              <div>
                <label className={labelClass}>Start time *</label>
                <input
                  {...register('scheduledTime')}
                  type="time"
                  className={inputClass}
                />
                {errors.scheduledTime && (
                  <p className="mt-1 text-xs text-red-600">{errors.scheduledTime.message}</p>
                )}
              </div>
              <div>
                <label className={labelClass}>Recurrence *</label>
                <select {...register('recurrenceType')} className={inputClass}>
                  <option value="DAILY">Daily</option>
                  <option value="WEEKLY">Weekly</option>
                  <option value="MONTHLY">Monthly</option>
                  <option value="CUSTOM">Custom (by weekday)</option>
                </select>
              </div>
            </div>

            {showDayPicker && (
              <div>
                <label className={labelClass}>Days of week *</label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {DAY_OPTIONS.map((d) => (
                    <button
                      key={d.value}
                      type="button"
                      onClick={() => toggleDay(d.value)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                        daysOfWeek.includes(d.value)
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-gray-600 border-gray-300 hover:border-blue-300'
                      }`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
                {errors.daysOfWeek && (
                  <p className="mt-1 text-xs text-red-600">{errors.daysOfWeek.message}</p>
                )}
              </div>
            )}

            {recurrenceType === 'MONTHLY' && (
              <p className="text-xs text-gray-500 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
                Monthly routes run on the same calendar day each month when the daily job
                generates executions.
              </p>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Default driver</label>
                <select {...register('defaultDriverId')} className={inputClass}>
                  <option value="">Unassigned</option>
                  {drivers.map((d) => (
                    <option key={d._id} value={d._id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Contract</label>
                <select {...register('contractId')} className={inputClass}>
                  <option value="">No contract</option>
                  {contracts.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.clientId?.name ?? c._id}
                      {c.slaMinutes ? ` · SLA ${c.slaMinutes}m` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                {...register('isTemplate')}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">Save as template (reusable route pattern)</span>
            </label>

            <RouteStopsEditor
              control={control}
              register={register}
              setValue={setValue}
              errors={errors}
              clients={clients}
            />

            {submitError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-700">
                  {getApiErrorMessage(submitError, 'Failed to save route')}
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
                  'Create route'
                )}
              </button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
