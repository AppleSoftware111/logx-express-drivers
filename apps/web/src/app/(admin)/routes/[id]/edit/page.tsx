'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';

import type { UpdateRouteInput } from '@logx/shared';

import {
  RoutePlannerForm,
  routeDetailToFormValues,
} from '@/components/routes/RoutePlannerForm';
import type { ClientOption } from '@/components/routes/RouteStopsEditor';
import { apiClient } from '@/lib/api';
import { useHasAccessToken } from '@/lib/authToken';

export default function EditRoutePlannerPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const sessionReady = useHasAccessToken();

  const { data: formResources, isLoading: loadingResources } = useQuery({
    queryKey: ['route-form-resources'],
    enabled: sessionReady,
    queryFn: async () => {
      const [clientsRes, driversRes, contractsRes] = await Promise.all([
        apiClient.get<{ success: boolean; data: ClientOption[] }>('/clients'),
        apiClient.get<{ success: boolean; data: Array<{ _id: string; name: string }> }>('/drivers'),
        apiClient.get<{
          success: boolean;
          data: Array<{ _id: string; slaMinutes?: number; clientId?: { _id?: string; name: string } }>;
        }>('/contracts'),
      ]);

      return {
        clients: clientsRes.data.data,
        drivers: driversRes.data.data,
        contracts: contractsRes.data.data,
      };
    },
  });

  const { data: route, isLoading: loadingRoute } = useQuery({
    queryKey: ['route', id],
    enabled: sessionReady && !!id,
    queryFn: async () => {
      const res = await apiClient.get(`/routes/${id}`);
      return res.data.data;
    },
  });

  const updateRoute = useMutation({
    mutationFn: async (payload: UpdateRouteInput) => {
      await apiClient.patch(`/routes/${id}`, payload);
    },
    onSuccess: () => {
      router.push(`/routes/${id}`);
    },
  });

  return (
    <div className="space-y-6 p-6">
      <Link
        href={`/routes/${id}`}
        className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to route review
      </Link>

      {loadingResources || loadingRoute ? (
        <div className="flex min-h-[50vh] items-center justify-center">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
        </div>
      ) : (
        <RoutePlannerForm
          mode="edit"
          initial={route ? routeDetailToFormValues(route) : null}
          clients={formResources?.clients ?? []}
          drivers={formResources?.drivers ?? []}
          contracts={formResources?.contracts ?? []}
          isSubmitting={updateRoute.isPending}
          submitError={updateRoute.error}
          onSubmit={(payload) => updateRoute.mutate(payload as UpdateRouteInput)}
          onCancel={() => router.push(`/routes/${id}`)}
        />
      )}
    </div>
  );
}
