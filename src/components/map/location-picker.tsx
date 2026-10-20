'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { NAIROBI, TrimmyMap } from './map';

// Where the business is: drag the pin or click the map, or use the browser's
// location. Customers' distance search and directions come from this pin.
export function LocationPicker({
  value, onChange,
}: {
  value: { lat: number; lng: number } | null;
  onChange: (pos: { lat: number; lng: number }) => void;
}) {
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState('');
  const pin = value ?? NAIROBI;

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setError("This browser can't share its location. Drag the pin instead.");
      return;
    }
    setLocating(true);
    setError('');
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setLocating(false);
        onChange({ lat: p.coords.latitude, lng: p.coords.longitude });
      },
      () => {
        setLocating(false);
        setError("Couldn't get your location. Drag the pin to your business instead.");
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold">Pin your business on the map</p>
        <Button type="button" variant="secondary" size="sm" onClick={useMyLocation} loading={locating}>
          Use my location
        </Button>
      </div>
      <TrimmyMap
        label="Map: drag the pin to your business's location"
        center={pin}
        zoom={value ? 17 : 13}
        draggablePin={pin}
        onPinMove={onChange}
        className="h-72 sm:h-80"
      />
      <p className="text-[13px] text-ink-2">
        {error || (value ? `Pinned at ${value.lat.toFixed(5)}, ${value.lng.toFixed(5)}. Drag to adjust.` : 'Drag the pin, or click the map where your business is.')}
      </p>
    </div>
  );
}
