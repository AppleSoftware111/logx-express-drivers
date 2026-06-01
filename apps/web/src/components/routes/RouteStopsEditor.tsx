'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, Clock3, MapPin, Plus, Search, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { Control, FieldErrors, UseFormRegister, UseFormSetValue } from 'react-hook-form';
import { useFieldArray, useWatch } from 'react-hook-form';

import { geocodeAddress } from '@/lib/geocoding';

export interface ClientOption {
  _id: string;
  name: string;
  address: string;
  location?: { coordinates: [number, number] };
}

export interface RouteStopRow {
  clientId: string;
  order: number;
  address: string;
  lat: string;
  lng: string;
  plannedTime: string;
  expectedDurationMinutes: number;
  type: 'PICKUP' | 'DELIVERY' | 'BOTH';
  instructions?: string;
}

export interface RouteFormValues {
  clientId: string;
  name: string;
  description?: string;
  scheduledTime: string;
  recurrenceType: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY' | 'CUSTOM';
  daysOfWeek: number[];
  dayOfMonth?: number;
  monthOfYear?: number;
  recurrenceStartDate: string;
  recurrenceEndDate?: string;
  isTemplate: boolean;
  defaultDriverId?: string;
  contractId?: string;
  stops: RouteStopRow[];
}

interface RouteStopsEditorProps {
  control: Control<RouteFormValues>;
  register: UseFormRegister<RouteFormValues>;
  setValue: UseFormSetValue<RouteFormValues>;
  errors: FieldErrors<RouteFormValues>;
  clients: ClientOption[];
}

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100';
const labelClass = 'mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500';

export function RouteStopsEditor({
  control,
  register,
  setValue,
  errors,
  clients,
}: RouteStopsEditorProps) {
  const t = useTranslations('routes');
  const { fields, append, remove, move } = useFieldArray({ control, name: 'stops' });
  const stops = useWatch({ control, name: 'stops' }) ?? [];
  const [geocodingIndex, setGeocodingIndex] = useState<number | null>(null);
  const stopTypes = [
    { value: 'PICKUP', label: t('pickup') },
    { value: 'DELIVERY', label: t('delivery') },
    { value: 'BOTH', label: t('both') },
  ] as const;

  const addStop = () => {
    const lastStop = stops[stops.length - 1];
    append({
      clientId: '',
      order: fields.length,
      address: '',
      lat: '',
      lng: '',
      plannedTime: lastStop?.plannedTime ?? '08:00',
      expectedDurationMinutes: 15,
      type: 'DELIVERY',
      instructions: '',
    });
  };

  const onClientChange = (index: number, clientId: string) => {
    const client = clients.find((candidate) => candidate._id === clientId);
    setValue(`stops.${index}.clientId`, clientId);
    if (!client) return;

    setValue(`stops.${index}.address`, client.address, { shouldDirty: true, shouldValidate: true });
    const coords = client.location?.coordinates;
    if (coords) {
      setValue(`stops.${index}.lng`, String(coords[0]), { shouldDirty: true });
      setValue(`stops.${index}.lat`, String(coords[1]), { shouldDirty: true });
    }
  };

  const geocodeStop = async (index: number) => {
    const stop = stops[index];
    if (!stop?.address?.trim()) return;

    setGeocodingIndex(index);
    try {
      const result = await geocodeAddress(stop.address);
      if (!result) return;

      setValue(`stops.${index}.address`, result.formattedAddress ?? stop.address, {
        shouldDirty: true,
        shouldValidate: true,
      });
      setValue(`stops.${index}.lat`, String(result.lat), { shouldDirty: true });
      setValue(`stops.${index}.lng`, String(result.lng), { shouldDirty: true });
    } finally {
      setGeocodingIndex(null);
    }
  };

  const stopsError = errors.stops?.message ?? errors.stops?.root?.message;

  return (
    <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-6 py-5">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">{t('stopTimetableTitle')}</h2>
          <p className="mt-1 text-sm text-slate-500">
            {t('stopTimetableSubtitle')}
          </p>
        </div>
        <button
          type="button"
          onClick={addStop}
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          {t('addStop')}
        </button>
      </div>

      <div className="space-y-4 p-6">
        {fields.length === 0 && (
          <p className="rounded-2xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
            {t('emptyStops')}
          </p>
        )}

        {fields.map((field, index) => {
          const stopError = errors.stops?.[index];
          const selectedClient = clients.find((client) => client._id === stops[index]?.clientId);

          return (
            <div
              key={field.id}
              className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">
                    {t('stop')} {index + 1}
                  </p>
                  <p className="mt-1 text-sm font-medium text-slate-900">
                    {selectedClient?.name ?? t('newScheduledStop')}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={index === 0}
                    onClick={() => move(index, index - 1)}
                    className="rounded-lg p-2 text-slate-400 transition hover:bg-white hover:text-slate-700 disabled:opacity-30"
                    title={t('moveUp')}
                  >
                    <ChevronUp className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    disabled={index === fields.length - 1}
                    onClick={() => move(index, index + 1)}
                    className="rounded-lg p-2 text-slate-400 transition hover:bg-white hover:text-slate-700 disabled:opacity-30"
                    title={t('moveDown')}
                  >
                    <ChevronDown className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(index)}
                    className="rounded-lg p-2 text-red-400 transition hover:bg-red-50 hover:text-red-600"
                    title={t('removeStop')}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-12">
                <div className="lg:col-span-4">
                  <label className={labelClass}>{t('form.client')}</label>
                  <select
                    className={inputClass}
                    {...register(`stops.${index}.clientId`, {
                      onChange: (event) => onClientChange(index, event.target.value),
                    })}
                  >
                    <option value="">{t('selectClient')}</option>
                    {clients.map((client) => (
                      <option key={client._id} value={client._id}>
                        {client.name}
                      </option>
                    ))}
                  </select>
                  {stopError?.clientId && (
                    <p className="mt-1 text-xs text-red-600">{stopError.clientId.message}</p>
                  )}
                </div>

                <div className="lg:col-span-2">
                  <label className={labelClass}>{t('form.plannedTime')}</label>
                  <div className="relative">
                    <Clock3 className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
                    <input
                      type="time"
                      {...register(`stops.${index}.plannedTime`)}
                      className={`${inputClass} pl-9`}
                    />
                  </div>
                  {stopError?.plannedTime && (
                    <p className="mt-1 text-xs text-red-600">{stopError.plannedTime.message}</p>
                  )}
                </div>

                <div className="lg:col-span-3">
                  <label className={labelClass}>{t('form.stopType')}</label>
                  <select {...register(`stops.${index}.type`)} className={inputClass}>
                    {stopTypes.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="lg:col-span-3">
                  <label className={labelClass}>{t('form.expectedDuration')}</label>
                  <input
                    type="number"
                    min={1}
                    {...register(`stops.${index}.expectedDurationMinutes`, { valueAsNumber: true })}
                    className={inputClass}
                  />
                </div>

                <div className="lg:col-span-9">
                  <label className={labelClass}>{t('addressSnapshot')}</label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <MapPin className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
                      <input
                        {...register(`stops.${index}.address`)}
                        className={`${inputClass} pl-9`}
                        placeholder={t('addressPlaceholder')}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => void geocodeStop(index)}
                      disabled={geocodingIndex === index}
                      className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-blue-200 hover:text-blue-700 disabled:opacity-60"
                    >
                      <Search className="h-4 w-4" />
                      {geocodingIndex === index ? t('checking') : t('geocode')}
                    </button>
                  </div>
                  {stopError?.address && (
                    <p className="mt-1 text-xs text-red-600">{stopError.address.message}</p>
                  )}
                </div>

                <div className="lg:col-span-3">
                  <label className={labelClass}>{t('coordinates')}</label>
                  <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-600">
                    {stops[index]?.lat && stops[index]?.lng
                      ? `${stops[index]?.lat}, ${stops[index]?.lng}`
                      : t('pendingGeocode')}
                  </div>
                </div>

                <div className="lg:col-span-12">
                  <label className={labelClass}>{t('instructions')}</label>
                  <textarea
                    {...register(`stops.${index}.instructions`)}
                    rows={2}
                    className={inputClass}
                    placeholder={t('instructionsPlaceholder')}
                  />
                </div>
              </div>

              <input type="hidden" {...register(`stops.${index}.order`, { valueAsNumber: true })} />
              <input type="hidden" {...register(`stops.${index}.lat`)} />
              <input type="hidden" {...register(`stops.${index}.lng`)} />
            </div>
          );
        })}

        {stopsError && <p className="text-sm text-red-600">{String(stopsError)}</p>}
      </div>
    </section>
  );
}
