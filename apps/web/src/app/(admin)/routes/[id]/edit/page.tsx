'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { useCallback, useState } from 'react';

import type { UpdateRouteInput } from '@logx/shared';

import {
  RoutePlannerForm,
  routeDetailToFormValues,
} from '@/components/routes/RoutePlannerForm';
import {
  RouteEditSyncModal,
  type RouteEditSyncPreviewData,
} from '@/components/routes/RouteEditSyncModal';
import type { ClientOption } from '@/components/routes/RouteStopsEditor';
import { apiClient } from '@/lib/api';
import { useHasAccessToken } from '@/lib/authToken';

type RouteEditSyncResult = {
  action: 'synced_open' | 'generated' | 'follow_up_created' | 'kept_completed' | 'none';
  synced: number;
  generated: number;
  followUpCreated: number;
};

export default function EditRoutePlannerPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const sessionReady = useHasAccessToken();
  const [pendingPayload, setPendingPayload] = useState<UpdateRouteInput | null>(null);
  const [syncPreview, setSyncPreview] = useState<RouteEditSyncPreviewData | null>(null);
  const [showSyncModal, setShowSyncModal] = useState(false);

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

  const redirectAfterSave = useCallback(
    (sync: RouteEditSyncResult, stopCount?: number) => {
      void queryClient.invalidateQueries({ queryKey: ['route', id] });
      void queryClient.invalidateQueries({ queryKey: ['route-schedule', id] });
      void queryClient.invalidateQueries({ queryKey: ['executions'] });
      void queryClient.invalidateQueries({ queryKey: ['today-routes'] });

      const params = new URLSearchParams();
      if (sync.action !== 'none') {
        params.set('syncAction', sync.action);
        if (stopCount !== undefined) {
          params.set('syncStops', String(stopCount));
        }
      }
      const query = params.toString();
      router.push(`/routes/${id}${query ? `?${query}` : ''}`);
    },
    [id, queryClient, router]
  );

  const updateRoute = useMutation({
    mutationFn: async (payload: UpdateRouteInput) => {
      const res = await apiClient.patch<{
        success: boolean;
        data: { route: unknown; sync: RouteEditSyncResult };
      }>(`/routes/${id}`, payload);
      return res.data.data;
    },
    onSuccess: (data) => {
      setShowSyncModal(false);
      setPendingPayload(null);
      setSyncPreview(null);
      redirectAfterSave(data.sync, syncPreview?.pendingNewStopCount);
    },
  });

  const submitRouteUpdate = useCallback(
    async (payload: UpdateRouteInput) => {
      if (payload.stops?.length) {
        const previewRes = await apiClient.post<{
          success: boolean;
          data: RouteEditSyncPreviewData & { needsCompletedTodayPrompt: boolean };
        }>(`/routes/${id}/edit-sync-preview`, { stops: payload.stops });

        if (previewRes.data.data.needsCompletedTodayPrompt) {
          setPendingPayload(payload);
          setSyncPreview(previewRes.data.data);
          setShowSyncModal(true);
          return;
        }
      }

      updateRoute.mutate(payload);
    },
    [id, updateRoute]
  );

  const handleSyncKeep = () => {
    if (!pendingPayload) return;
    updateRoute.mutate({ ...pendingPayload, completedTodayAction: 'keep' });
  };

  const handleSyncFollowUp = (options: {
    followUpScheduledTime: string;
    followUpLabel?: string;
  }) => {
    if (!pendingPayload) return;
    updateRoute.mutate({
      ...pendingPayload,
      completedTodayAction: 'create_follow_up',
      followUpScheduledTime: options.followUpScheduledTime,
      followUpLabel: options.followUpLabel,
    });
  };

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
          onSubmit={(payload) => void submitRouteUpdate(payload as UpdateRouteInput)}
          onCancel={() => router.push(`/routes/${id}`)}
        />
      )}

      <RouteEditSyncModal
        open={showSyncModal}
        preview={syncPreview}
        isSubmitting={updateRoute.isPending}
        onClose={() => {
          if (updateRoute.isPending) return;
          setShowSyncModal(false);
          setPendingPayload(null);
          setSyncPreview(null);
        }}
        onKeepCompleted={handleSyncKeep}
        onCreateFollowUp={handleSyncFollowUp}
      />
    </div>
  );
}
