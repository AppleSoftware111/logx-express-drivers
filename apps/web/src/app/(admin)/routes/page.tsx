'use client';

import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Plus, Eye, Power, Pencil, Route as RouteIcon } from 'lucide-react';

import type { CreateRouteInput, UpdateRouteInput } from '@logx/shared';

import {
  RouteFormDialog,
  routeDetailToFormValues,
} from '@/components/routes/RouteFormDialog';
import type { RouteFormValues } from '@/components/routes/RouteStopsEditor';
import type { ClientOption } from '@/components/routes/RouteStopsEditor';
import { EmptyState } from '@/components/ui/EmptyState';
import { apiClient } from '@/lib/api';
import { useHasAccessToken } from '@/lib/authToken';
import { queryClient } from '@/lib/queryClient';

interface Route {
  _id: string;
  name: string;
  scheduledTime: string;
  recurrenceType: string;
  daysOfWeek: number[];
  isActive: boolean;
  isTemplate: boolean;
  defaultDriverId?: { name: string };
  stops: Array<{ _id: string; clientId: { name: string } }>;
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function RoutesPage() {
  const t = useTranslations('routes');
  const router = useRouter();
  const sessionReady = useHasAccessToken();
  const [isActive, setIsActive] = useState<string>('true');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRouteId, setEditingRouteId] = useState<string | null>(null);

  const { data: routes, isLoading } = useQuery({
    queryKey: ['routes', isActive],
    enabled: sessionReady,
    queryFn: async () => {
      const params = new URLSearchParams({ isActive });
      const res = await apiClient.get<{ success: boolean; data: Route[] }>(
        `/routes?${params.toString()}`
      );
      return res.data.data;
    },
  });

  const { data: formResources } = useQuery({
    queryKey: ['route-form-resources'],
    enabled: sessionReady && dialogOpen,
    queryFn: async () => {
      const [clientsRes, driversRes, contractsRes] = await Promise.all([
        apiClient.get<{ success: boolean; data: ClientOption[] }>('/clients'),
        apiClient.get<{ success: boolean; data: Array<{ _id: string; name: string }> }>(
          '/drivers'
        ),
        apiClient.get<{
          success: boolean;
          data: Array<{
            _id: string;
            slaMinutes?: number;
            clientId?: { name: string };
          }>;
        }>('/contracts'),
      ]);
      return {
        clients: clientsRes.data.data,
        drivers: driversRes.data.data,
        contracts: contractsRes.data.data,
      };
    },
  });

  const { data: editRoute, isLoading: loadingEditRoute } = useQuery({
    queryKey: ['route', editingRouteId],
    enabled: !!editingRouteId && dialogOpen,
    queryFn: async () => {
      const res = await apiClient.get(`/routes/${editingRouteId}`);
      return res.data.data;
    },
  });

  const createRoute = useMutation({
    mutationFn: async (payload: CreateRouteInput) => {
      const res = await apiClient.post<{ success: boolean; data: { _id: string } }>(
        '/routes',
        payload
      );
      return res.data.data;
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: ['routes'] });
      setDialogOpen(false);
      setEditingRouteId(null);
      router.push(`/routes/${data._id}`);
    },
  });

  const updateRoute = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: UpdateRouteInput }) => {
      const res = await apiClient.patch(`/routes/${id}`, payload);
      return res.data.data;
    },
    onSuccess: (_, { id }) => {
      void queryClient.invalidateQueries({ queryKey: ['routes'] });
      void queryClient.invalidateQueries({ queryKey: ['route', id] });
      setDialogOpen(false);
      setEditingRouteId(null);
    },
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, isActive: active }: { id: string; isActive: boolean }) => {
      await apiClient.patch(`/routes/${id}/active`, { isActive: active });
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['routes'] }),
  });

  const openCreate = () => {
    setEditingRouteId(null);
    setDialogOpen(true);
  };

  const openEdit = (routeId: string) => {
    setEditingRouteId(routeId);
    setDialogOpen(true);
  };

  const handleDialogSubmit = (payload: CreateRouteInput | UpdateRouteInput) => {
    if (editingRouteId) {
      updateRoute.mutate({ id: editingRouteId, payload });
    } else {
      createRoute.mutate(payload as CreateRouteInput);
    }
  };

  const editFormInitial: RouteFormValues | null =
    editingRouteId && editRoute ? routeDetailToFormValues(editRoute) : null;

  const isSubmitting = createRoute.isPending || updateRoute.isPending;
  const submitError = createRoute.error ?? updateRoute.error;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
          <p className="text-sm text-gray-500 mt-1">Manage recurring delivery routes</p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Route
        </button>
      </div>

      <div className="flex items-center gap-3">
        <select
          value={isActive}
          onChange={(e) => setIsActive(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="true">Active routes</option>
          <option value="false">Inactive routes</option>
        </select>
        <span className="text-sm text-gray-400">{routes?.length ?? 0} routes</span>
      </div>

      <div className="bg-white rounded-xl border border-gray-200">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3 text-left">Route Name</th>
                <th className="px-5 py-3 text-left">Driver</th>
                <th className="px-5 py-3 text-left">Schedule</th>
                <th className="px-5 py-3 text-left">Recurrence</th>
                <th className="px-5 py-3 text-left">Stops</th>
                <th className="px-5 py-3 text-left">Status</th>
                <th className="px-5 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading && (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-gray-400">
                    <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                  </td>
                </tr>
              )}
              {!isLoading && routes?.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-0">
                    <EmptyState
                      Icon={RouteIcon}
                      title="No routes yet"
                      description="Create a recurring route with ordered client stops for daily execution."
                      action={
                        <button
                          type="button"
                          onClick={openCreate}
                          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
                        >
                          <Plus className="w-4 h-4" />
                          New Route
                        </button>
                      }
                    />
                  </td>
                </tr>
              )}
              {routes?.map((route) => (
                <tr key={route._id} className="hover:bg-gray-50">
                  <td className="px-5 py-3 font-medium text-gray-900">
                    {route.name}
                    {route.isTemplate && (
                      <span className="ml-2 text-xs bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded">
                        Template
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-gray-600">
                    {route.defaultDriverId?.name ?? '—'}
                  </td>
                  <td className="px-5 py-3 text-gray-600 font-mono">{route.scheduledTime}</td>
                  <td className="px-5 py-3 text-gray-600">
                    {route.recurrenceType === 'WEEKLY' || route.recurrenceType === 'CUSTOM'
                      ? route.daysOfWeek.map((d) => DAY_LABELS[d]).join(', ')
                      : route.recurrenceType}
                  </td>
                  <td className="px-5 py-3 text-gray-600">{route.stops.length}</td>
                  <td className="px-5 py-3">
                    <span
                      className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                        route.isActive
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {route.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openEdit(route._id)}
                        className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
                        title="Edit route"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <Link
                        href={`/routes/${route._id}`}
                        className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
                        title="View route"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </Link>
                      <button
                        type="button"
                        onClick={() =>
                          toggleActive.mutate({ id: route._id, isActive: !route.isActive })
                        }
                        disabled={toggleActive.isPending}
                        className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
                        title={route.isActive ? 'Deactivate' : 'Activate'}
                      >
                        <Power className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <RouteFormDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditingRouteId(null);
        }}
        mode={editingRouteId ? 'edit' : 'create'}
        initial={editFormInitial}
        loadingInitial={!!editingRouteId && loadingEditRoute}
        clients={formResources?.clients ?? []}
        drivers={formResources?.drivers ?? []}
        contracts={formResources?.contracts ?? []}
        isSubmitting={isSubmitting}
        submitError={submitError}
        onSubmit={handleDialogSubmit}
      />
    </div>
  );
}
