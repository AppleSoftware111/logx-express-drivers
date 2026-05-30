'use client';

import { useTranslations } from 'next-intl';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle, FileImage, MapPin, User } from 'lucide-react';

import { apiClient } from '@/lib/api';
import { formatDateTime } from '@/lib/utils';

function PODContent() {
  const t = useTranslations('portal');
  const searchParams = useSearchParams();
  const executionId = searchParams.get('executionId');

  const { data: execution, isLoading } = useQuery({
    queryKey: ['execution-pod', executionId],
    queryFn: async () => {
      const res = await apiClient.get(`/executions/${executionId}`);
      return res.data.data;
    },
    enabled: !!executionId,
  });

  if (!executionId) {
    return (
      <div className="text-center py-16 text-gray-400">
        <p>Select a delivery from the history page to view POD</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  const completedStops = execution?.stops?.filter(
    (s: { status: string; podPhoto?: string; podSignature?: string }) =>
      s.status === 'COMPLETED' && (s.podPhoto || s.podSignature)
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t('podTitle')}</h1>
        <p className="text-sm text-gray-500 mt-1">
          {execution?.routeId?.name} ·{' '}
          {execution?.scheduledDate
            ? new Date(execution.scheduledDate).toLocaleDateString('pt-BR')
            : ''}
        </p>
      </div>

      {completedStops?.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <FileImage className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>No POD documents available yet</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {completedStops?.map((stop: {
          _id: string;
          order: number;
          address: string;
          status: string;
          clientId: { name: string; type: string };
          arrivedAt?: string;
          completedAt?: string;
          waitingTimeMinutes?: number;
          receiverName?: string;
          deliveryNotes?: string;
          podPhoto?: string;
          podSignature?: string;
          deliveryLocation?: { lat: number; lng: number };
        }) => (
          <div key={stop._id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 bg-gray-50">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-gray-900">{stop.clientId?.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">Stop {stop.order + 1} · {stop.address}</p>
                </div>
                <CheckCircle className="w-5 h-5 text-green-500" />
              </div>
            </div>

            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                {stop.arrivedAt && (
                  <div>
                    <p className="text-xs text-gray-400">Arrived</p>
                    <p className="text-gray-700">{formatDateTime(stop.arrivedAt)}</p>
                  </div>
                )}
                {stop.completedAt && (
                  <div>
                    <p className="text-xs text-gray-400">Completed</p>
                    <p className="text-gray-700">{formatDateTime(stop.completedAt)}</p>
                  </div>
                )}
                {stop.waitingTimeMinutes !== undefined && (
                  <div>
                    <p className="text-xs text-gray-400">Waiting time</p>
                    <p className="font-medium text-blue-600">{stop.waitingTimeMinutes} min</p>
                  </div>
                )}
                {stop.receiverName && (
                  <div>
                    <p className="text-xs text-gray-400">Receiver</p>
                    <p className="text-gray-700 flex items-center gap-1">
                      <User className="w-3 h-3" />
                      {stop.receiverName}
                    </p>
                  </div>
                )}
              </div>

              {stop.deliveryNotes && (
                <div>
                  <p className="text-xs text-gray-400 mb-1">Notes</p>
                  <p className="text-sm text-gray-600 bg-gray-50 px-3 py-2 rounded">{stop.deliveryNotes}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                {stop.podPhoto && (
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Photo</p>
                    <div className="aspect-video bg-gray-100 rounded-lg flex items-center justify-center">
                      <FileImage className="w-6 h-6 text-gray-300" />
                      <span className="text-xs text-gray-400 ml-2">View Photo</span>
                    </div>
                  </div>
                )}
                {stop.podSignature && (
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Signature</p>
                    <div className="aspect-video bg-gray-100 rounded-lg flex items-center justify-center">
                      <span className="text-xs text-gray-400">View Signature</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function PODPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-16"><div className="animate-spin h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full" /></div>}>
      <PODContent />
    </Suspense>
  );
}
