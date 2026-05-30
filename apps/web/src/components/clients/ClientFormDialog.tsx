'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, MapPin } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import type { CreateClientInput, UpdateClientInput } from '@logx/shared';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { getApiErrorMessage } from '@/lib/apiError';
import { geocodeAddress } from '@/lib/geocoding';
import { hasGoogleMapsApiKey } from '@/lib/maps';

const CLIENT_TYPES = [
  { value: 'HOSPITAL', label: 'Hospital' },
  { value: 'LABORATORY', label: 'Laboratory' },
  { value: 'OTHER', label: 'Other' },
] as const;

const clientFormSchema = z
  .object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    type: z.enum(['HOSPITAL', 'LABORATORY', 'OTHER']),
    address: z.string().min(5, 'Address must be at least 5 characters'),
    cnpj: z.string().optional(),
    lat: z.string().optional(),
    lng: z.string().optional(),
    createPortalUser: z.boolean().default(false),
    portalEmail: z.string().optional(),
    portalPassword: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.cnpj?.trim()) {
      const digits = data.cnpj.replace(/\D/g, '');
      if (digits.length !== 14) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'CNPJ must be 14 digits',
          path: ['cnpj'],
        });
      }
    }
    const lat = parseCoord(data.lat);
    const lng = parseCoord(data.lng);
    if (lat === null || lng === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Set location using “Find on map” or enter latitude and longitude',
        path: ['address'],
      });
    }
    if (data.createPortalUser) {
      if (!data.portalEmail?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Email is required for portal access',
          path: ['portalEmail'],
        });
      } else if (!z.string().email().safeParse(data.portalEmail).success) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Invalid email address',
          path: ['portalEmail'],
        });
      }
      if (!data.portalPassword || data.portalPassword.length < 8) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Password must be at least 8 characters',
          path: ['portalPassword'],
        });
      }
    }
  });

type ClientFormValues = z.infer<typeof clientFormSchema>;

export interface ClientFormInitial {
  _id: string;
  name: string;
  type: string;
  address: string;
  cnpj?: string;
  location?: { coordinates: [number, number] };
}

interface ClientFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'edit';
  initial?: ClientFormInitial | null;
  isSubmitting: boolean;
  submitError: unknown;
  onSubmit: (payload: CreateClientInput | UpdateClientInput) => void;
}

function parseCoord(value?: string): number | null {
  if (value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function coordToString(n?: number): string {
  return n !== undefined && Number.isFinite(n) ? String(n) : '';
}

function normalizePayload(values: ClientFormValues): CreateClientInput | UpdateClientInput {
  const lat = parseCoord(values.lat)!;
  const lng = parseCoord(values.lng)!;
  const cnpjDigits = values.cnpj?.replace(/\D/g, '');

  const base = {
    name: values.name.trim(),
    type: values.type,
    address: values.address.trim(),
    lat,
    lng,
    cnpj: cnpjDigits && cnpjDigits.length === 14 ? cnpjDigits : undefined,
  };

  if (values.createPortalUser) {
    return {
      ...base,
      createPortalUser: true,
      portalEmail: values.portalEmail?.trim().toLowerCase(),
      portalPassword: values.portalPassword,
    } as CreateClientInput;
  }

  return base;
}

export function ClientFormDialog({
  open,
  onOpenChange,
  mode,
  initial,
  isSubmitting,
  submitError,
  onSubmit,
}: ClientFormDialogProps) {
  const isEdit = mode === 'edit';
  const mapsAvailable = hasGoogleMapsApiKey();
  const [geocoding, setGeocoding] = useState(false);
  const [geocodeError, setGeocodeError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ClientFormValues>({
    resolver: zodResolver(clientFormSchema),
    defaultValues: {
      name: '',
      type: 'HOSPITAL',
      address: '',
      cnpj: '',
      lat: '',
      lng: '',
      createPortalUser: false,
      portalEmail: '',
      portalPassword: '',
    },
  });

  const createPortalUser = watch('createPortalUser');
  const lat = watch('lat');
  const lng = watch('lng');
  const hasCoords = parseCoord(lat) !== null && parseCoord(lng) !== null;

  useEffect(() => {
    if (!open) return;

    if (isEdit && initial) {
      const coords = initial.location?.coordinates;
      reset({
        name: initial.name,
        type: initial.type as ClientFormValues['type'],
        address: initial.address,
        cnpj: initial.cnpj ?? '',
        lat: coords ? coordToString(coords[1]) : '',
        lng: coords ? coordToString(coords[0]) : '',
        createPortalUser: false,
        portalEmail: '',
        portalPassword: '',
      });
    } else {
      reset({
        name: '',
        type: 'HOSPITAL',
        address: '',
        cnpj: '',
        lat: '',
        lng: '',
        createPortalUser: false,
        portalEmail: '',
        portalPassword: '',
      });
    }
    setGeocodeError(null);
  }, [open, isEdit, initial, reset]);

  const handleGeocode = async () => {
    const address = watch('address')?.trim();
    if (!address || address.length < 5) {
      setGeocodeError('Enter a full address first');
      return;
    }

    if (!mapsAvailable) {
      setGeocodeError('Google Maps key not configured — enter coordinates manually');
      return;
    }

    setGeocoding(true);
    setGeocodeError(null);
    try {
      const result = await geocodeAddress(address);
      if (!result) {
        setGeocodeError('Could not find this address. Check spelling or enter coordinates.');
        return;
      }
      setValue('lat', coordToString(result.lat));
      setValue('lng', coordToString(result.lng));
      if (result.formattedAddress) {
        setValue('address', result.formattedAddress);
      }
    } catch {
      setGeocodeError('Geocoding failed. Try again or enter coordinates manually.');
    } finally {
      setGeocoding(false);
    }
  };

  const handleFormSubmit = (values: ClientFormValues) => {
    const payload = normalizePayload(values);
    if (isEdit) {
      const {
        createPortalUser: _c,
        portalEmail: _e,
        portalPassword: _p,
        ...updatePayload
      } = payload as CreateClientInput;
      onSubmit(updatePayload);
      return;
    }
    onSubmit(payload as CreateClientInput);
  };

  const inputClass =
    'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent';
  const labelClass = 'block text-sm font-medium text-gray-700 mb-1';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit client' : 'Add client'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Update hospital or laboratory details and delivery location.'
              : 'Register a client site for routes and stop planning.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className={labelClass}>Name *</label>
              <input
                {...register('name')}
                className={inputClass}
                placeholder="Hospital São Lucas"
                autoFocus
              />
              {errors.name && (
                <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>
              )}
            </div>

            <div>
              <label className={labelClass}>Type *</label>
              <select {...register('type')} className={inputClass}>
                {CLIENT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelClass}>CNPJ</label>
              <input
                {...register('cnpj')}
                className={inputClass}
                placeholder="00.000.000/0001-00"
                maxLength={18}
              />
              {errors.cnpj && (
                <p className="mt-1 text-xs text-red-600">{errors.cnpj.message}</p>
              )}
            </div>
          </div>

          <div>
            <label className={labelClass}>Address *</label>
            <textarea
              {...register('address')}
              rows={2}
              className={inputClass}
              placeholder="Street, number, city — São Paulo, SP"
            />
            {errors.address && (
              <p className="mt-1 text-xs text-red-600">{errors.address.message}</p>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void handleGeocode()}
                disabled={geocoding}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-50"
              >
                {geocoding ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <MapPin className="w-3.5 h-3.5" />
                )}
                Find on map
              </button>
              {hasCoords && (
                <span className="text-xs text-green-700">
                  Location set ({parseCoord(lat)?.toFixed(5)}, {parseCoord(lng)?.toFixed(5)})
                </span>
              )}
            </div>
            {geocodeError && (
              <p className="mt-1 text-xs text-amber-700">{geocodeError}</p>
            )}
            {!mapsAvailable && (
              <p className="mt-1 text-xs text-gray-500">
                Add NEXT_PUBLIC_GOOGLE_MAPS_KEY to enable automatic geocoding.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Latitude</label>
              <input
                {...register('lat')}
                className={inputClass}
                placeholder="-23.5505"
                inputMode="decimal"
              />
            </div>
            <div>
              <label className={labelClass}>Longitude</label>
              <input
                {...register('lng')}
                className={inputClass}
                placeholder="-46.6333"
                inputMode="decimal"
              />
            </div>
          </div>

          {!isEdit && (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  {...register('createPortalUser')}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-800">
                  Create client portal login
                </span>
              </label>
              <p className="text-xs text-gray-500">
                Allows the client to track deliveries and view reports in the portal.
              </p>

              {createPortalUser && (
                <div className="grid grid-cols-1 gap-3 pt-1">
                  <div>
                    <label className={labelClass}>Portal email *</label>
                    <input
                      {...register('portalEmail')}
                      type="email"
                      className={inputClass}
                      placeholder="client@hospital.com"
                      autoComplete="off"
                    />
                    {errors.portalEmail && (
                      <p className="mt-1 text-xs text-red-600">{errors.portalEmail.message}</p>
                    )}
                  </div>
                  <div>
                    <label className={labelClass}>Portal password *</label>
                    <input
                      {...register('portalPassword')}
                      type="password"
                      className={inputClass}
                      placeholder="Min. 8 characters"
                      autoComplete="new-password"
                    />
                    {errors.portalPassword && (
                      <p className="mt-1 text-xs text-red-600">
                        {errors.portalPassword.message}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {submitError != null ? (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-700">
                  {getApiErrorMessage(submitError, 'Failed to save client')}
                </p>
              </div>
            ) : null}

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
                'Create client'
              )}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
