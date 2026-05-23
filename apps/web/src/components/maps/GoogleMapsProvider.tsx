'use client';

import { APIProvider } from '@vis.gl/react-google-maps';

import { getGoogleMapsApiKey } from '@/lib/maps';

interface GoogleMapsProviderProps {
  children: React.ReactNode;
  className?: string;
}

export function GoogleMapsProvider({ children, className }: GoogleMapsProviderProps) {
  const apiKey = getGoogleMapsApiKey();

  if (!apiKey) {
    return (
      <div className="flex h-full min-h-[240px] items-center justify-center bg-gray-100 p-6 text-center text-sm text-gray-500">
        <p>
          Google Maps is not configured. Set{' '}
          <code className="rounded bg-gray-200 px-1 text-xs">NEXT_PUBLIC_GOOGLE_MAPS_KEY</code> in{' '}
          <code className="rounded bg-gray-200 px-1 text-xs">apps/web/.env.local</code> and restart
          the dev server.
        </p>
      </div>
    );
  }

  return (
    <div className={className ?? 'h-full w-full'}>
      <APIProvider apiKey={apiKey}>{children}</APIProvider>
    </div>
  );
}
