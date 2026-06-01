'use client';

import { AdvancedMarker, Map, Pin, Polyline } from '@vis.gl/react-google-maps';
import { useTranslations } from 'next-intl';

import type { RouteStopRow } from '@/components/routes/RouteStopsEditor';
import { GoogleMapsProvider } from '@/components/maps/GoogleMapsProvider';

interface RouteMapPreviewProps {
  stops: RouteStopRow[];
}

function getMapCenter(stops: RouteStopRow[]) {
  const validStops = stops.filter((stop) => stop.lat && stop.lng);
  if (!validStops.length) {
    return { lat: -23.5505, lng: -46.6333 };
  }

  const total = validStops.reduce(
    (acc, stop) => ({
      lat: acc.lat + Number(stop.lat),
      lng: acc.lng + Number(stop.lng),
    }),
    { lat: 0, lng: 0 }
  );

  return {
    lat: total.lat / validStops.length,
    lng: total.lng / validStops.length,
  };
}

export function RouteMapPreview({ stops }: RouteMapPreviewProps) {
  const t = useTranslations('routes');
  const validStops = stops
    .filter((stop) => stop.lat && stop.lng)
    .map((stop, index) => ({
      ...stop,
      order: index,
      lat: Number(stop.lat),
      lng: Number(stop.lng),
    }));

  return (
    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-6 py-5">
        <h2 className="text-lg font-semibold text-slate-900">{t('previewTitle')}</h2>
        <p className="mt-1 text-sm text-slate-500">
          {t('previewSubtitle')}
        </p>
      </div>

      <div className="h-[420px]">
        <GoogleMapsProvider className="h-full w-full">
          <Map
            center={getMapCenter(stops)}
            defaultZoom={11}
            mapId="logx-route-planner-map"
            gestureHandling="greedy"
            className="h-full w-full"
          >
            {validStops.length > 1 && (
              <Polyline
                path={validStops.map((stop) => ({ lat: stop.lat, lng: stop.lng }))}
                strokeColor="#2563eb"
                strokeOpacity={0.9}
                strokeWeight={4}
              />
            )}

            {validStops.map((stop, index) => (
              <AdvancedMarker
                key={`${stop.clientId}-${index}`}
                position={{ lat: stop.lat, lng: stop.lng }}
                title={`${index + 1}. ${stop.plannedTime} · ${stop.address}`}
              >
                <Pin
                  background={index === 0 ? '#1d4ed8' : '#2563eb'}
                  borderColor="#ffffff"
                  glyphColor="#ffffff"
                  scale={1.15}
                />
              </AdvancedMarker>
            ))}
          </Map>
        </GoogleMapsProvider>
      </div>
    </section>
  );
}
