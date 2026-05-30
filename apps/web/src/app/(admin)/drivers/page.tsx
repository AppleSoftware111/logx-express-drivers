'use client';

import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Plus, Pencil, Power, Truck, Users } from 'lucide-react';
import { useTranslations } from 'next-intl';

import type { CreateDriverInput, UpdateDriverInput } from '@logx/shared';

import { DriverFormDialog, type DriverFormInitial } from '@/components/drivers/DriverFormDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { apiClient } from '@/lib/api';
import { useHasAccessToken } from '@/lib/authToken';
import { queryClient } from '@/lib/queryClient';

interface Driver {
  _id: string;
  name: string;
  phone?: string;
  cpf?: string;
  licenseNumber?: string;
  isActive: boolean;
  isOnline: boolean;
  vehicleId?: { _id: string; plate: string; model: string; type: string };
  currentLocation?: { lat: number; lng: number; updatedAt: string };
}

interface Vehicle {
  _id: string;
  plate: string;
  model: string;
  type: string;
}

export default function DriversPage() {
  const t = useTranslations('drivers');
  const tCommon = useTranslations('common');
  const sessionReady = useHasAccessToken();
  const [onlineOnly, setOnlineOnly] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDriver, setEditingDriver] = useState<DriverFormInitial | null>(null);

  const { data: drivers, isLoading } = useQuery({
    queryKey: ['drivers', onlineOnly],
    enabled: sessionReady,
    queryFn: async () => {
      const params = onlineOnly ? '?online=true' : '';
      const res = await apiClient.get<{ success: boolean; data: Driver[] }>(
        `/drivers${params}`
      );
      return res.data.data;
    },
    refetchInterval: 10_000,
  });

  const { data: vehicles = [] } = useQuery({
    queryKey: ['vehicles'],
    enabled: sessionReady && dialogOpen,
    queryFn: async () => {
      const res = await apiClient.get<{ success: boolean; data: Vehicle[] }>('/vehicles');
      return res.data.data;
    },
  });

  const createDriver = useMutation({
    mutationFn: async (payload: CreateDriverInput) => {
      const res = await apiClient.post<{ success: boolean; data: Driver }>(
        '/drivers',
        payload
      );
      return res.data.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['drivers'] });
      setDialogOpen(false);
      setEditingDriver(null);
    },
  });

  const updateDriver = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: UpdateDriverInput }) => {
      const res = await apiClient.patch<{ success: boolean; data: Driver }>(
        `/drivers/${id}`,
        payload
      );
      return res.data.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['drivers'] });
      setDialogOpen(false);
      setEditingDriver(null);
    },
  });

  const toggleOnline = useMutation({
    mutationFn: async ({ id, isOnline }: { id: string; isOnline: boolean }) => {
      await apiClient.patch(`/drivers/${id}/online`, { isOnline });
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['drivers'] }),
  });

  const openCreate = () => {
    setEditingDriver(null);
    setDialogOpen(true);
  };

  const openEdit = (driver: Driver) => {
    setEditingDriver({
      _id: driver._id,
      name: driver.name,
      phone: driver.phone,
      cpf: driver.cpf,
      licenseNumber: driver.licenseNumber,
      vehicleId: driver.vehicleId,
    });
    setDialogOpen(true);
  };

  const handleDialogSubmit = (payload: CreateDriverInput | UpdateDriverInput) => {
    if (editingDriver) {
      updateDriver.mutate({ id: editingDriver._id, payload: payload as UpdateDriverInput });
    } else {
      createDriver.mutate(payload as CreateDriverInput);
    }
  };

  const isSubmitting = createDriver.isPending || updateDriver.isPending;
  const submitError = createDriver.error ?? updateDriver.error;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
          <p className="text-sm text-gray-500 mt-1">{t('subtitle')}</p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          {t('addDriver')}
        </button>
      </div>

      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
          <input
            type="checkbox"
            checked={onlineOnly}
            onChange={(e) => setOnlineOnly(e.target.checked)}
            className="rounded"
          />
          {t('onlineOnly')}
        </label>
        <span className="text-sm text-gray-400">
          {t('driverCount', { count: drivers?.length ?? 0 })}
        </span>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full" />
        </div>
      )}

      {!isLoading && drivers?.length === 0 && (
        <EmptyState
          Icon={Users}
          title={t('noDriversYet')}
          description={t('noDriversDesc')}
          action={
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Driver
            </button>
          }
        />
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {drivers?.map((driver) => (
          <div
            key={driver._id}
            className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-sm transition-shadow"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold uppercase">
                    {driver.name.slice(0, 2)}
                  </div>
                  <div
                    className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${
                      driver.isOnline ? 'bg-green-500' : 'bg-gray-300'
                    }`}
                  />
                </div>
                <div>
                  <p className="font-semibold text-gray-900">{driver.name}</p>
                  <p className="text-xs text-gray-400">{driver.phone ?? t('noPhone')}</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => openEdit(driver)}
                  className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
                  title={t('editTitle')}
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    toggleOnline.mutate({ id: driver._id, isOnline: !driver.isOnline })
                  }
                  disabled={toggleOnline.isPending}
                  className={`p-2 rounded-lg transition-colors ${
                    driver.isOnline
                      ? 'bg-green-50 text-green-600 hover:bg-green-100'
                      : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                  }`}
                  title={driver.isOnline ? t('setOffline') : t('setOnline')}
                >
                  <Power className="w-4 h-4" />
                </button>
              </div>
            </div>

            {driver.licenseNumber && (
              <p className="mt-2 text-xs text-gray-500">
                {t('license')}: {driver.licenseNumber}
              </p>
            )}

            {driver.vehicleId && (
              <div className="mt-3 flex items-center gap-2 text-xs text-gray-500">
                <Truck className="w-3.5 h-3.5" />
                {driver.vehicleId.plate} — {driver.vehicleId.model}
              </div>
            )}

            {driver.isOnline && driver.currentLocation && (
              <div className="mt-2 text-xs text-green-600">
                {t('lastSeen')}:{' '}
                {new Date(driver.currentLocation.updatedAt).toLocaleTimeString('pt-BR')}
              </div>
            )}
          </div>
        ))}
      </div>

      <DriverFormDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditingDriver(null);
        }}
        mode={editingDriver ? 'edit' : 'create'}
        initial={editingDriver}
        vehicles={vehicles}
        isSubmitting={isSubmitting}
        submitError={submitError}
        onSubmit={handleDialogSubmit}
      />
    </div>
  );
}
