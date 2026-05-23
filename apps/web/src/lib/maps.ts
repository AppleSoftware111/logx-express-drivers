/** Client-side Google Maps API key (must be NEXT_PUBLIC_ for Next.js). */
export function getGoogleMapsApiKey(): string {
  return (process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY ?? '').trim();
}

export function hasGoogleMapsApiKey(): boolean {
  return getGoogleMapsApiKey().length > 0;
}
