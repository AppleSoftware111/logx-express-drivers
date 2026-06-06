'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { FieldErrors } from 'react-hook-form';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';

import type { CreateRouteInput, UpdateRouteInput } from '@logx/shared';

import { RouteMapPreview } from '@/components/routes/RouteMapPreview';
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

const MONTH_OPTIONS = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
];

const routeFormSchema = z
  .object({
    clientId: z.string().min(1, 'Select a customer'),
    name: z.string().min(2, 'Route name must be at least 2 characters'),
    description: z.string().optional(),
    scheduledTime: z
      .string()
      .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Use HH:mm format (e.g. 08:30)"),
    recurrenceType: z.enum(['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY', 'CUSTOM']),
    daysOfWeek: z.array(z.number().int().min(0).max(6)),
    dayOfMonth: z.coerce.number().int().min(1).max(31).optional(),
    monthOfYear: z.coerce.number().int().min(1).max(12).optional(),
    recurrenceStartDate: z.string().min(1, 'Choose a recurrence start date'),
    recurrenceEndDate: z.string().optional(),
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
          plannedTime: z
            .string()
            .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Use HH:mm format (e.g. 08:30)"),
          expectedDurationMinutes: z.coerce.number().int().min(1),
          type: z.enum(['PICKUP', 'DELIVERY', 'BOTH']),
          instructions: z.string().optional(),
        })
      )
      .min(1, 'Add at least one stop'),
  })
  .superRefine((data, ctx) => {
    if ((data.recurrenceType === 'WEEKLY' || data.recurrenceType === 'CUSTOM') && !data.daysOfWeek.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Select at least one day of the week',
        path: ['daysOfWeek'],
      });
    }

    if (data.recurrenceType === 'MONTHLY' && !data.dayOfMonth) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Choose a calendar day for monthly recurrence',
        path: ['dayOfMonth'],
      });
    }

    if (data.recurrenceType === 'YEARLY') {
      if (!data.dayOfMonth) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Choose a calendar day for yearly recurrence',
          path: ['dayOfMonth'],
        });
      }
      if (!data.monthOfYear) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Choose a month for yearly recurrence',
          path: ['monthOfYear'],
        });
      }
    }

    if (data.recurrenceEndDate && data.recurrenceEndDate < data.recurrenceStartDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'End date must be after start date',
        path: ['recurrenceEndDate'],
      });
    }

    data.stops.forEach((stop, index) => {
      const lat = parseCoord(stop.lat);
      const lng = parseCoord(stop.lng);
      if (lat === null || lng === null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Use a mapped address for this stop',
          path: ['stops', index, 'address'],
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
  clientId?: { _id?: string; name: string };
  slaMinutes?: number;
}

interface RoutePlannerFormProps {
  mode: 'create' | 'edit';
  initial?: RouteFormValues | null;
  clients: ClientOption[];
  drivers: DriverOption[];
  contracts: ContractOption[];
  isSubmitting: boolean;
  submitError: unknown;
  onSubmit: (payload: CreateRouteInput | UpdateRouteInput) => void;
  onCancel: () => void;
}

type ValidationIssue = {
  path: string;
  message: string;
};

function todayDateString() {
  return new Date().toISOString().slice(0, 10);
}

function parseCoord(value?: string): number | null {
  if (!value) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizeScheduledTime(time: string): string {
  const match = time.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return time;
  return `${match[1].padStart(2, '0')}:${match[2]}`;
}

function getRouteStartTime(stops: RouteFormValues['stops']) {
  return normalizeScheduledTime(stops[0]?.plannedTime ?? '08:00');
}

function normalizePayload(values: RouteFormValues): CreateRouteInput {
  const recurrenceType = values.recurrenceType;

  return {
    clientId: values.clientId,
    name: values.name.trim(),
    description: values.description?.trim() || undefined,
    scheduledTime: getRouteStartTime(values.stops),
    recurrenceType,
    daysOfWeek:
      recurrenceType === 'WEEKLY' || recurrenceType === 'CUSTOM' ? values.daysOfWeek : [],
    dayOfMonth:
      recurrenceType === 'MONTHLY' || recurrenceType === 'YEARLY'
        ? values.dayOfMonth || undefined
        : undefined,
    monthOfYear: recurrenceType === 'YEARLY' ? values.monthOfYear || undefined : undefined,
    recurrenceStartDate: values.recurrenceStartDate,
    recurrenceEndDate: values.recurrenceEndDate || undefined,
    isTemplate: values.isTemplate,
    defaultDriverId: values.defaultDriverId || undefined,
    contractId: values.contractId || undefined,
    stops: values.stops.map((stop, index) => ({
      clientId: stop.clientId,
      order: index,
      address: stop.address.trim(),
      lat: parseCoord(stop.lat)!,
      lng: parseCoord(stop.lng)!,
      plannedTime: normalizeScheduledTime(stop.plannedTime),
      expectedDurationMinutes: stop.expectedDurationMinutes,
      type: stop.type,
      instructions: stop.instructions?.trim() || undefined,
    })),
  };
}

function collectValidationIssues(
  errors: FieldErrors<RouteFormValues>,
  prefix = ''
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const [key, value] of Object.entries(errors)) {
    if (key === 'ref' || key === 'type' || key === 'types') continue;
    if (!value) continue;

    const path = prefix ? `${prefix}.${key}` : key;

    if (typeof value === 'object' && value !== null && 'message' in value && typeof value.message === 'string') {
      issues.push({ path, message: value.message });
    }

    if (Array.isArray(value)) {
      value.forEach((item, index) => {
        if (item && typeof item === 'object') {
          issues.push(...collectValidationIssues(item as FieldErrors<RouteFormValues>, `${path}.${index}`));
        }
      });
      continue;
    }

    if (typeof value === 'object' && value !== null) {
      issues.push(...collectValidationIssues(value as FieldErrors<RouteFormValues>, path));
    }
  }

  const seen = new Set<string>();
  return issues.filter((issue) => {
    const key = `${issue.path}:${issue.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function routeDetailToFormValues(route: {
  clientId?: string | { _id: string };
  name: string;
  description?: string;
  scheduledTime: string;
  recurrenceType: string;
  daysOfWeek: number[];
  dayOfMonth?: number;
  monthOfYear?: number;
  recurrenceStartDate?: string;
  recurrenceEndDate?: string;
  isTemplate: boolean;
  defaultDriverId?: string | { _id: string };
  contractId?: string | { _id: string };
  stops: Array<{
    clientId: string | { _id: string };
    order: number;
    address: string;
    location: { lat: number; lng: number };
    plannedTime?: string;
    expectedDurationMinutes: number;
    type: string;
    instructions?: string;
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
  const clientId =
    typeof route.clientId === 'object' && route.clientId
      ? route.clientId._id
      : (route.clientId as string | undefined);

  return {
    clientId: clientId ?? '',
    name: route.name,
    description: route.description ?? '',
    scheduledTime: route.scheduledTime,
    recurrenceType: route.recurrenceType as RouteFormValues['recurrenceType'],
    daysOfWeek: route.daysOfWeek ?? [],
    dayOfMonth: route.dayOfMonth,
    monthOfYear: route.monthOfYear,
    recurrenceStartDate: route.recurrenceStartDate?.slice(0, 10) ?? todayDateString(),
    recurrenceEndDate: route.recurrenceEndDate?.slice(0, 10) ?? '',
    isTemplate: route.isTemplate ?? false,
    defaultDriverId: driverId ?? '',
    contractId: contractId ?? '',
    stops: route.stops
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((stop) => ({
        clientId: typeof stop.clientId === 'object' ? stop.clientId._id : stop.clientId,
        order: stop.order,
        address: stop.address,
        lat: String(stop.location.lat),
        lng: String(stop.location.lng),
        plannedTime: stop.plannedTime ?? route.scheduledTime,
        expectedDurationMinutes: stop.expectedDurationMinutes ?? 15,
        type: stop.type as RouteStopRow['type'],
        instructions: stop.instructions ?? '',
      })),
  };
}

const defaultValues: RouteFormValues = {
  clientId: '',
  name: '',
  description: '',
  scheduledTime: '08:00',
  recurrenceType: 'WEEKLY',
  daysOfWeek: [1, 2, 3, 4, 5],
  dayOfMonth: 1,
  monthOfYear: 1,
  recurrenceStartDate: todayDateString(),
  recurrenceEndDate: '',
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
      plannedTime: '08:00',
      expectedDurationMinutes: 15,
      type: 'DELIVERY',
      instructions: '',
    },
  ],
};

export function RoutePlannerForm({
  mode,
  initial,
  clients,
  drivers,
  contracts,
  isSubmitting,
  submitError,
  onSubmit,
  onCancel,
}: RoutePlannerFormProps) {
  const t = useTranslations('routes');
  const isEdit = mode === 'edit';
  const formRef = useRef<HTMLFormElement | null>(null);
  const validationSummaryRef = useRef<HTMLDivElement | null>(null);
  const [validationIssues, setValidationIssues] = useState<ValidationIssue[]>([]);
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    control,
    formState: { errors },
  } = useForm<RouteFormValues>({
    resolver: zodResolver(routeFormSchema),
    defaultValues,
  });

  const recurrenceType = useWatch({ control, name: 'recurrenceType' });
  const watchedDaysOfWeek = useWatch({ control, name: 'daysOfWeek' });
  const watchedStops = useWatch({ control, name: 'stops' });
  const daysOfWeek = useMemo(() => watchedDaysOfWeek ?? [], [watchedDaysOfWeek]);
  const stops = useMemo(() => watchedStops ?? [], [watchedStops]);
  const customerId = useWatch({ control, name: 'clientId' });

  useEffect(() => {
    if (initial) {
      reset(initial);
    } else {
      reset(defaultValues);
    }
    setValidationIssues([]);
  }, [initial, reset]);

  useEffect(() => {
    setValue('scheduledTime', getRouteStartTime(stops), { shouldDirty: true });
  }, [setValue, stops]);

  useEffect(() => {
    if (validationIssues.length > 0) {
      setValidationIssues(collectValidationIssues(errors));
    }
  }, [errors, validationIssues.length]);

  const toggleDay = (day: number) => {
    const next = daysOfWeek.includes(day)
      ? daysOfWeek.filter((currentDay) => currentDay !== day)
      : [...daysOfWeek, day].sort((a, b) => a - b);
    setValue('daysOfWeek', next, { shouldDirty: true, shouldValidate: true });
  };

  const selectedCustomer = clients.find((client) => client._id === customerId);
  const filteredContracts = contracts.filter(
    (contract) => !customerId || contract.clientId?._id === customerId
  );
  const routeStartTime = getRouteStartTime(stops);
  const recurrenceOptions = [
    { value: 'DAILY', label: t('daily') },
    { value: 'WEEKLY', label: t('weekly') },
    { value: 'MONTHLY', label: t('monthly') },
    { value: 'YEARLY', label: t('yearly') },
    { value: 'CUSTOM', label: t('custom') },
  ];

  const sectionClass = 'rounded-3xl border border-slate-200 bg-white p-6 shadow-sm';
  const inputClass =
    'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100';
  const labelClass = 'mb-1.5 block text-sm font-medium text-slate-700';

  const scrollToValidationIssue = (path?: string) => {
    const form = formRef.current;
    if (!form) return;

    const sanitizedPath = path?.replace(/\.root$/, '');
    const selectorPath = sanitizedPath
      ? sanitizedPath.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
      : '';

    const target = selectorPath
      ? form.querySelector<HTMLElement>(`[name="${selectorPath}"], [data-field="${selectorPath}"]`)
      : null;

    const fallbackTarget = validationSummaryRef.current;
    const element = target ?? fallbackTarget;

    if (!element) return;

    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (
      target instanceof HTMLInputElement ||
      target instanceof HTMLSelectElement ||
      target instanceof HTMLTextAreaElement
    ) {
      target.focus();
    }
  };

  const handleValidSubmit = (values: RouteFormValues) => {
    setValidationIssues([]);
    onSubmit(normalizePayload(values));
  };

  const handleInvalidSubmit = (formErrors: FieldErrors<RouteFormValues>) => {
    const issues = collectValidationIssues(formErrors);
    setValidationIssues(issues);
    window.requestAnimationFrame(() => {
      scrollToValidationIssue(issues[0]?.path);
    });
  };

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit(handleValidSubmit, handleInvalidSubmit)}
      className="space-y-6"
    >
      {validationIssues.length > 0 && (
        <div
          ref={validationSummaryRef}
          className="rounded-2xl border border-amber-200 bg-amber-50 p-4"
        >
          <p className="text-sm font-semibold text-amber-900">{t('validationSummaryTitle')}</p>
          <p className="mt-1 text-sm text-amber-800">{t('validationSummaryBody')}</p>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-amber-900">
            {validationIssues.slice(0, 5).map((issue) => (
              <li key={`${issue.path}:${issue.message}`}>{issue.message}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_420px]">
        <div className="space-y-6">
          <section className={sectionClass}>
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-600">
                  {t('fixedPlanner')}
                </p>
                <h1 className="mt-2 text-3xl font-bold text-slate-950">
                  {isEdit ? t('editFixedRouteTitle') : t('createFixedRouteTitle')}
                </h1>
                <p className="mt-2 text-sm text-slate-500">
                  {t('plannerSubtitle')}
                </p>
              </div>
              <div className="rounded-2xl bg-slate-50 px-4 py-3 text-right">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{t('routeStart')}</p>
                <p className="mt-1 font-mono text-xl font-semibold text-slate-900">{routeStartTime}</p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className={labelClass}>{t('customer')} *</label>
                <select {...register('clientId')} className={inputClass}>
                  <option value="">{t('selectCustomer')}</option>
                  {clients.map((client) => (
                    <option key={client._id} value={client._id}>
                      {client.name}
                    </option>
                  ))}
                </select>
                {errors.clientId && (
                  <p className="mt-1 text-xs text-red-600">{errors.clientId.message}</p>
                )}
              </div>

              <div>
                <label className={labelClass}>{t('form.driver')}</label>
                <select {...register('defaultDriverId')} className={inputClass}>
                  <option value="">{t('unassigned')}</option>
                  {drivers.map((driver) => (
                    <option key={driver._id} value={driver._id}>
                      {driver.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <label className={labelClass}>{t('form.name')} *</label>
                <input
                  {...register('name')}
                  className={inputClass}
                  placeholder="Laboratory X collection"
                  autoFocus
                />
                {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>}
              </div>

              <div className="md:col-span-2">
                <label className={labelClass}>{t('description')}</label>
                <textarea
                  {...register('description')}
                  rows={3}
                  className={inputClass}
                  placeholder="Optional operational notes for this route"
                />
              </div>

              <div>
                <label className={labelClass}>{t('contract')}</label>
                <select {...register('contractId')} className={inputClass}>
                  <option value="">{t('noContract')}</option>
                  {filteredContracts.map((contract) => (
                    <option key={contract._id} value={contract._id}>
                      {contract.clientId?.name ?? contract._id}
                      {contract.slaMinutes ? ` · SLA ${contract.slaMinutes}m` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <label className="mt-7 inline-flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  {...register('isTemplate')}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                {t('saveTemplate')}
              </label>
            </div>
          </section>

          <section className={sectionClass}>
            <div className="mb-5">
              <h2 className="text-lg font-semibold text-slate-900">{t('recurrence')}</h2>
              <p className="mt-1 text-sm text-slate-500">
                {t('recurrenceSubtitle')}
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className={labelClass}>{t('recurrenceType')} *</label>
                <select {...register('recurrenceType')} className={inputClass}>
                  {recurrenceOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelClass}>{t('derivedStartTime')}</label>
                <input value={routeStartTime} readOnly className={`${inputClass} bg-slate-50`} />
              </div>

              <div>
                <label className={labelClass}>{t('recurrenceStart')} *</label>
                <input type="date" {...register('recurrenceStartDate')} className={inputClass} />
                {errors.recurrenceStartDate && (
                  <p className="mt-1 text-xs text-red-600">{errors.recurrenceStartDate.message}</p>
                )}
              </div>

              <div>
                <label className={labelClass}>{t('recurrenceEnd')}</label>
                <input type="date" {...register('recurrenceEndDate')} className={inputClass} />
                {errors.recurrenceEndDate && (
                  <p className="mt-1 text-xs text-red-600">{errors.recurrenceEndDate.message}</p>
                )}
              </div>
            </div>

            {(recurrenceType === 'WEEKLY' || recurrenceType === 'CUSTOM') && (
              <div className="mt-5" data-field="daysOfWeek">
                <label className={labelClass}>{t('daysOfWeek')} *</label>
                <div className="flex flex-wrap gap-2">
                  {DAY_OPTIONS.map((day) => (
                    <button
                      key={day.value}
                      type="button"
                      onClick={() => toggleDay(day.value)}
                      className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                        daysOfWeek.includes(day.value)
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {day.label}
                    </button>
                  ))}
                </div>
                {errors.daysOfWeek && (
                  <p className="mt-2 text-xs text-red-600">{errors.daysOfWeek.message}</p>
                )}
              </div>
            )}

            {recurrenceType === 'MONTHLY' && (
              <div className="mt-5 max-w-xs">
                <label className={labelClass}>{t('dayOfMonth')} *</label>
                <input type="number" min={1} max={31} {...register('dayOfMonth')} className={inputClass} />
                {errors.dayOfMonth && (
                  <p className="mt-1 text-xs text-red-600">{errors.dayOfMonth.message}</p>
                )}
              </div>
            )}

            {recurrenceType === 'YEARLY' && (
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <div>
                  <label className={labelClass}>{t('month')} *</label>
                  <select {...register('monthOfYear')} className={inputClass}>
                    {MONTH_OPTIONS.map((month) => (
                      <option key={month.value} value={month.value}>
                        {month.label}
                      </option>
                    ))}
                  </select>
                  {errors.monthOfYear && (
                    <p className="mt-1 text-xs text-red-600">{errors.monthOfYear.message}</p>
                  )}
                </div>

                <div>
                  <label className={labelClass}>{t('dayOfMonth')} *</label>
                  <input type="number" min={1} max={31} {...register('dayOfMonth')} className={inputClass} />
                  {errors.dayOfMonth && (
                    <p className="mt-1 text-xs text-red-600">{errors.dayOfMonth.message}</p>
                  )}
                </div>
              </div>
            )}
          </section>

          <div data-field="stops">
            <RouteStopsEditor
              control={control}
              register={register}
              setValue={setValue}
              errors={errors}
              clients={clients}
            />
          </div>

          {submitError != null && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
              <p className="text-sm text-red-700">
                {getApiErrorMessage(submitError, 'Failed to save route')}
              </p>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <RouteMapPreview stops={stops} />

          <section className={sectionClass}>
            <h2 className="text-lg font-semibold text-slate-900">{t('planningSummary')}</h2>
            <div className="mt-4 space-y-3 text-sm text-slate-600">
              <div className="flex items-center justify-between">
                <span>{t('customer')}</span>
                <span className="font-medium text-slate-900">
                  {selectedCustomer?.name ?? t('notSelected')}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>{t('stops')}</span>
                <span className="font-medium text-slate-900">{stops.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>{t('firstStop')}</span>
                <span className="font-medium text-slate-900">{stops[0]?.plannedTime ?? '--:--'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>{t('lastStop')}</span>
                <span className="font-medium text-slate-900">
                  {stops[stops.length - 1]?.plannedTime ?? '--:--'}
                </span>
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-3">
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t('savingRoute')}
                  </>
                ) : isEdit ? (
                  t('saveRouteChanges')
                ) : (
                  t('createFixedRouteTitle')
                )}
              </button>
              <button
                type="button"
                onClick={onCancel}
                disabled={isSubmitting}
                className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {t('cancel')}
              </button>
            </div>
          </section>
        </div>
      </div>
    </form>
  );
}
