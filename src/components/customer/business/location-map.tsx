'use client';

import { TrimmyMap } from '@/components/map/map';

// Where the business is, on its profile page.
export function BusinessLocationMap({ lat, lng, name }: { lat: number; lng: number; name: string }) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) return null;
  return (
    <TrimmyMap
      label={`Map showing where ${name} is`}
      center={{ lat, lng }}
      zoom={16}
      pins={[{ id: 'here', lat, lng }]}
      className="mt-3 h-64"
    />
  );
}
