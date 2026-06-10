import {
  DRIVER_LOCATION_LIVE_WINDOW_MS,
  DRIVER_LOCATION_RECENT_WINDOW_MS,
  DRIVER_LOCATION_STALE_WINDOW_MS,
} from '@logx/shared';

export function getLocationFreshnessState(updatedAt?: string) {
  if (!updatedAt) {
    return { labelKey: 'locationUnknown', dotClassName: 'bg-gray-300', textClassName: 'text-gray-400' };
  }

  const ageMs = Date.now() - new Date(updatedAt).getTime();
  if (ageMs <= DRIVER_LOCATION_LIVE_WINDOW_MS) {
    return { labelKey: 'liveNow', dotClassName: 'bg-green-500', textClassName: 'text-green-600' };
  }

  if (ageMs <= DRIVER_LOCATION_RECENT_WINDOW_MS) {
    return { labelKey: 'updatedRecently', dotClassName: 'bg-amber-400', textClassName: 'text-amber-600' };
  }

  if (ageMs <= DRIVER_LOCATION_STALE_WINDOW_MS) {
    return { labelKey: 'staleLocation', dotClassName: 'bg-gray-400', textClassName: 'text-gray-500' };
  }

  return { labelKey: 'offlineLocation', dotClassName: 'bg-rose-400', textClassName: 'text-rose-600' };
}
