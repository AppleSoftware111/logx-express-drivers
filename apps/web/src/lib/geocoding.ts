import { getGoogleMapsApiKey, hasGoogleMapsApiKey } from '@/lib/maps';

export interface GeocodeResult {
  lat: number;
  lng: number;
  formattedAddress?: string;
}

export async function geocodeAddress(address: string): Promise<GeocodeResult | null> {
  if (!hasGoogleMapsApiKey()) return null;

  const key = getGoogleMapsApiKey();
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${key}`;

  const res = await fetch(url);
  const data = (await res.json()) as {
    status: string;
    results?: Array<{
      formatted_address: string;
      geometry: { location: { lat: number; lng: number } };
    }>;
    error_message?: string;
  };

  if (data.status !== 'OK' || !data.results?.[0]) {
    return null;
  }

  const { lat, lng } = data.results[0].geometry.location;
  return {
    lat,
    lng,
    formattedAddress: data.results[0].formatted_address,
  };
}
