'use client';

import { Bike, CarFront, Truck } from 'lucide-react';

interface Props {
  vehicleType?: string;
  freshness?: string;
  highlighted?: boolean;
}

function getVehicleIcon(vehicleType?: string) {
  switch (vehicleType) {
    case 'MOTORCYCLE':
      return Bike;
    case 'TRUCK':
    case 'VAN':
      return Truck;
    case 'CAR':
    default:
      return CarFront;
  }
}

function getMarkerColors(freshness = 'locationUnknown') {
  switch (freshness) {
    case 'liveNow':
      return {
        shell: 'bg-emerald-500 border-emerald-600 text-white',
        pulse: 'bg-emerald-200',
      };
    case 'updatedRecently':
      return {
        shell: 'bg-amber-500 border-amber-600 text-white',
        pulse: 'bg-amber-200',
      };
    case 'staleLocation':
      return {
        shell: 'bg-slate-500 border-slate-600 text-white',
        pulse: 'bg-slate-200',
      };
    case 'offlineLocation':
      return {
        shell: 'bg-rose-500 border-rose-600 text-white',
        pulse: 'bg-rose-200',
      };
    case 'locationUnknown':
    default:
      return {
        shell: 'bg-blue-500 border-blue-600 text-white',
        pulse: 'bg-blue-200',
      };
  }
}

export function LiveVehicleMarker({
  vehicleType,
  freshness = 'locationUnknown',
  highlighted = false,
}: Props) {
  const Icon = getVehicleIcon(vehicleType);
  const colors = getMarkerColors(freshness);

  return (
    <div className="relative">
      <div
        className={`absolute left-1/2 top-1/2 h-12 w-12 -translate-x-1/2 -translate-y-1/2 rounded-full ${colors.pulse} opacity-70 ${
          highlighted ? 'scale-110' : 'scale-100'
        }`}
      />
      <div
        className={`relative flex h-10 w-10 items-center justify-center rounded-full border-2 shadow-lg ${colors.shell} ${
          highlighted ? 'ring-4 ring-blue-100' : ''
        }`}
      >
        <Icon className="h-5 w-5" strokeWidth={2.4} />
      </div>
    </div>
  );
}
