'use client';

import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';
import type { Control, UseFormRegister, UseFormSetValue, FieldErrors } from 'react-hook-form';
import { useFieldArray } from 'react-hook-form';

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
  expectedDurationMinutes: number;
  type: 'PICKUP' | 'DELIVERY' | 'BOTH';
}

export interface RouteFormValues {
  name: string;
  description?: string;
  scheduledTime: string;
  recurrenceType: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'CUSTOM';
  daysOfWeek: number[];
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

const STOP_TYPES = [
  { value: 'PICKUP', label: 'Pickup' },
  { value: 'DELIVERY', label: 'Delivery' },
  { value: 'BOTH', label: 'Pickup & delivery' },
] as const;

const inputClass =
  'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent';
const labelClass = 'block text-xs font-medium text-gray-600 mb-1';

export function RouteStopsEditor({
  control,
  register,
  setValue,
  errors,
  clients,
}: RouteStopsEditorProps) {
  const { fields, append, remove, move } = useFieldArray({ control, name: 'stops' });

  const addStop = () => {
    append({
      clientId: '',
      order: fields.length,
      address: '',
      lat: '',
      lng: '',
      expectedDurationMinutes: 15,
      type: 'DELIVERY',
    });
  };

  const onClientChange = (index: number, clientId: string) => {
    const client = clients.find((c) => c._id === clientId);
    if (!client) return;
    setValue(`stops.${index}.clientId`, clientId);
    setValue(`stops.${index}.address`, client.address);
    const coords = client.location?.coordinates;
    if (coords) {
      setValue(`stops.${index}.lng`, String(coords[0]));
      setValue(`stops.${index}.lat`, String(coords[1]));
    }
  };

  const stopsError = errors.stops?.message ?? errors.stops?.root?.message;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">Route stops *</h3>
        <button
          type="button"
          onClick={addStop}
          className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800"
        >
          <Plus className="w-3.5 h-3.5" />
          Add stop
        </button>
      </div>

      {fields.length === 0 && (
        <p className="text-sm text-gray-500 py-4 text-center border border-dashed border-gray-200 rounded-lg">
          Add at least one stop (client location).
        </p>
      )}

      <div className="space-y-3 max-h-[280px] overflow-y-auto pr-1">
        {fields.map((field, index) => (
          <div
            key={field.id}
            className="border border-gray-200 rounded-lg p-3 bg-gray-50/80 space-y-2"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                Stop {index + 1}
              </span>
              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  disabled={index === 0}
                  onClick={() => move(index, index - 1)}
                  className="p-1 rounded text-gray-400 hover:bg-white disabled:opacity-30"
                  title="Move up"
                >
                  <ChevronUp className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  disabled={index === fields.length - 1}
                  onClick={() => move(index, index + 1)}
                  className="p-1 rounded text-gray-400 hover:bg-white disabled:opacity-30"
                  title="Move down"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => remove(index)}
                  className="p-1 rounded text-red-400 hover:bg-red-50 hover:text-red-600"
                  title="Remove stop"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="sm:col-span-2">
                <label className={labelClass}>Client *</label>
                <select
                  className={inputClass}
                  {...register(`stops.${index}.clientId`, {
                    onChange: (e) => onClientChange(index, e.target.value),
                  })}
                >
                  <option value="">Select client…</option>
                  {clients.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                {errors.stops?.[index]?.clientId && (
                  <p className="mt-0.5 text-xs text-red-600">
                    {errors.stops[index]?.clientId?.message}
                  </p>
                )}
              </div>
              <div>
                <label className={labelClass}>Stop type</label>
                <select {...register(`stops.${index}.type`)} className={inputClass}>
                  {STOP_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Duration (min)</label>
                <input
                  type="number"
                  min={1}
                  {...register(`stops.${index}.expectedDurationMinutes`, { valueAsNumber: true })}
                  className={inputClass}
                />
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass}>Address</label>
                <input
                  {...register(`stops.${index}.address`)}
                  className={inputClass}
                  readOnly
                  placeholder="Select a client"
                />
              </div>
            </div>
            <input type="hidden" {...register(`stops.${index}.order`, { valueAsNumber: true })} />
            <input type="hidden" {...register(`stops.${index}.lat`)} />
            <input type="hidden" {...register(`stops.${index}.lng`)} />
          </div>
        ))}
      </div>

      {stopsError && <p className="text-xs text-red-600">{String(stopsError)}</p>}
    </div>
  );
}
