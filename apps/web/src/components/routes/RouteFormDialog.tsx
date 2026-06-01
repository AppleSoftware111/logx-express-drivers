'use client';

import type { CreateRouteInput, UpdateRouteInput } from '@logx/shared';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  RoutePlannerForm,
  routeDetailToFormValues,
} from '@/components/routes/RoutePlannerForm';
import type { ClientOption, RouteFormValues } from '@/components/routes/RouteStopsEditor';

interface DriverOption {
  _id: string;
  name: string;
}

interface ContractOption {
  _id: string;
  clientId?: { _id?: string; name: string };
  slaMinutes?: number;
}

interface RouteFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'edit';
  initial?: RouteFormValues | null;
  loadingInitial?: boolean;
  clients: ClientOption[];
  drivers: DriverOption[];
  contracts: ContractOption[];
  isSubmitting: boolean;
  submitError: unknown;
  onSubmit: (payload: CreateRouteInput | UpdateRouteInput) => void;
}

export { routeDetailToFormValues };

export function RouteFormDialog({
  open,
  onOpenChange,
  mode,
  initial,
  loadingInitial,
  clients,
  drivers,
  contracts,
  isSubmitting,
  submitError,
  onSubmit,
}: RouteFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-[1200px] overflow-y-auto p-0">
        <DialogHeader className="border-b border-slate-100 px-6 py-4">
          <DialogTitle>{mode === 'edit' ? 'Edit fixed route' : 'Create fixed route'}</DialogTitle>
        </DialogHeader>

        {loadingInitial ? (
          <div className="flex min-h-[320px] items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
          </div>
        ) : (
          <div className="p-6">
            <RoutePlannerForm
              mode={mode}
              initial={initial}
              clients={clients}
              drivers={drivers}
              contracts={contracts}
              isSubmitting={isSubmitting}
              submitError={submitError}
              onSubmit={onSubmit}
              onCancel={() => onOpenChange(false)}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
