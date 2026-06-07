'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Building2, Pencil, Plus, Power } from 'lucide-react';

import type { ApiSuccessResponse, CreateClientInput, UpdateClientInput } from '@logx/shared';

import { ClientFormDialog, type ClientFormInitial } from '@/components/clients/ClientFormDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { PaginationControls } from '@/components/ui/PaginationControls';
import { apiClient } from '@/lib/api';
import { useHasAccessToken } from '@/lib/authToken';
import { queryClient } from '@/lib/queryClient';

interface Client {
  _id: string;
  name: string;
  type: string;
  address: string;
  cnpj?: string;
  isActive: boolean;
  location?: { coordinates: [number, number] };
  userId?: { email: string; isActive: boolean };
}

const TYPE_COLORS: Record<string, string> = {
  HOSPITAL: 'bg-blue-100 text-blue-700',
  LABORATORY: 'bg-purple-100 text-purple-700',
  OTHER: 'bg-gray-100 text-gray-700',
};

export default function ClientsPage() {
  const t = useTranslations('clients');
  const tCommon = useTranslations('common');
  const sessionReady = useHasAccessToken();
  const [type, setType] = useState('');
  const [isActive, setIsActive] = useState('true');
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<ClientFormInitial | null>(null);
  const pageSize = 10;

  const { data, isLoading } = useQuery({
    queryKey: ['clients', type, isActive, page],
    enabled: sessionReady,
    queryFn: async () => {
      const params = new URLSearchParams({ isActive, page: String(page), limit: String(pageSize) });
      if (type) params.set('type', type);
      const res = await apiClient.get<ApiSuccessResponse<Client[]>>(
        `/clients?${params.toString()}`
      );
      return res.data;
    },
  });

  const clients = data?.data ?? [];
  const meta = data?.meta;

  useEffect(() => {
    if (meta && meta.totalPages > 0 && page > meta.totalPages) {
      setPage(meta.totalPages);
    }
  }, [meta, page]);

  const createClient = useMutation({
    mutationFn: async (payload: CreateClientInput) => {
      const res = await apiClient.post<{ success: boolean; data: Client }>(
        '/clients',
        payload
      );
      return res.data.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['clients'] });
      setDialogOpen(false);
    },
  });

  const updateClient = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: UpdateClientInput }) => {
      const res = await apiClient.patch<{ success: boolean; data: Client }>(
        `/clients/${id}`,
        payload
      );
      return res.data.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['clients'] });
      setDialogOpen(false);
    },
  });

  const toggleClientActive = useMutation({
    mutationFn: async ({ id, isActive: active }: { id: string; isActive: boolean }) => {
      const res = await apiClient.patch<{ success: boolean; data: Client }>(
        `/clients/${id}/active`,
        { isActive: active }
      );
      return res.data.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['clients'] });
    },
  });

  const openCreate = () => {
    setEditingClient(null);
    setDialogOpen(true);
  };

  const openEdit = (client: Client) => {
    setEditingClient({
      _id: client._id,
      name: client.name,
      type: client.type,
      address: client.address,
      cnpj: client.cnpj,
      location: client.location,
    });
    setDialogOpen(true);
  };

  const handleDialogSubmit = (payload: CreateClientInput | UpdateClientInput) => {
    if (editingClient) {
      updateClient.mutate({ id: editingClient._id, payload: payload as UpdateClientInput });
    } else {
      createClient.mutate(payload as CreateClientInput);
    }
  };

  const isSubmitting = createClient.isPending || updateClient.isPending;
  const submitError = createClient.error ?? updateClient.error;

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
          {t('addClient')}
        </button>
      </div>

      <div className="flex items-center gap-3">
        <select
          value={type}
          onChange={(e) => {
            setType(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">{t('allTypes')}</option>
          <option value="HOSPITAL">{t('typeHospital')}</option>
          <option value="LABORATORY">{t('typeLaboratory')}</option>
          <option value="OTHER">{t('typeOther')}</option>
        </select>
        <select
          value={isActive}
          onChange={(e) => {
            setIsActive(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="true">{t('activeClients')}</option>
          <option value="false">{t('inactiveClients')}</option>
        </select>
        <span className="text-sm text-gray-400">
          {t('clientCount', { count: meta?.total ?? clients.length })}
        </span>
      </div>

      <div className="bg-white rounded-xl border border-gray-200">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3 text-left">{tCommon('name')}</th>
                <th className="px-5 py-3 text-left">{t('form.type')}</th>
                <th className="px-5 py-3 text-left">{tCommon('address')}</th>
                <th className="px-5 py-3 text-left">CNPJ</th>
                <th className="px-5 py-3 text-left">{t('portalUser')}</th>
                <th className="px-5 py-3 text-left">{tCommon('status')}</th>
                <th className="px-5 py-3 text-right w-16" />
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
              {!isLoading && clients.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-0">
                    <EmptyState
                      Icon={Building2}
                      title={t('noClientsYet')}
                      description={t('noClientsDesc')}
                      action={
                        <button
                          type="button"
                          onClick={openCreate}
                          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
                        >
                          <Plus className="w-4 h-4" />
                          {t('addClient')}
                        </button>
                      }
                    />
                  </td>
                </tr>
              )}
              {clients.map((client) => (
                <tr key={client._id} className="hover:bg-gray-50">
                  <td className="px-5 py-3 font-medium text-gray-900">{client.name}</td>
                  <td className="px-5 py-3">
                    <span
                      className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_COLORS[client.type] ?? 'bg-gray-100 text-gray-700'}`}
                    >
                      {client.type}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-gray-500 max-w-xs truncate">{client.address}</td>
                  <td className="px-5 py-3 text-gray-500 font-mono text-xs">
                    {client.cnpj ?? '—'}
                  </td>
                  <td className="px-5 py-3 text-gray-500 text-xs">
                    {client.userId?.email ?? (
                      <span className="text-gray-300">{t('noPortalAccess')}</span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                        client.isActive
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {client.isActive ? tCommon('active') : tCommon('inactive')}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => openEdit(client)}
                        className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
                        title={t('editClient')}
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          toggleClientActive.mutate({ id: client._id, isActive: !client.isActive })
                        }
                        disabled={toggleClientActive.isPending}
                        className={`p-2 rounded-lg transition-colors ${
                          client.isActive
                            ? 'bg-amber-50 text-amber-600 hover:bg-amber-100'
                            : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                        }`}
                        title={client.isActive ? t('deactivateClient') : t('activateClient')}
                      >
                        <Power className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <PaginationControls
          page={meta?.page ?? page}
          totalPages={meta?.totalPages ?? 1}
          totalItems={meta?.total ?? clients.length}
          pageSize={meta?.limit ?? pageSize}
          currentCount={clients.length}
          onPageChange={setPage}
        />
      </div>

      <ClientFormDialog
        key={editingClient?._id ?? 'create-client'}
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditingClient(null);
        }}
        mode={editingClient ? 'edit' : 'create'}
        initial={editingClient}
        isSubmitting={isSubmitting}
        submitError={submitError}
        onSubmit={handleDialogSubmit}
      />
    </div>
  );
}
