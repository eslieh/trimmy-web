'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { NAIROBI, TrimmyMap } from '@/components/map/map';
import { money } from '@/lib/format';
import { cx } from '@/lib/format';
import type { BusinessSummary } from '@/types/discovery';

// Explore's results as the card grid (rendered on the server, passed in) or a
// map with a price pin per business. The map only loads when it's opened.
export function ResultsView({ businesses, list }: { businesses: BusinessSummary[]; list: React.ReactNode }) {
  const router = useRouter();
  const [view, setView] = useState<'list' | 'map'>('list');
  const located = businesses.filter((b) => Number.isFinite(b.lat) && Number.isFinite(b.lng) && (b.lat !== 0 || b.lng !== 0));
  const center = located[0] ? { lat: located[0].lat, lng: located[0].lng } : NAIROBI;

  return (
    <div className="flex flex-col gap-4">
      <div role="tablist" aria-label="Show results as" className="flex gap-2 self-end">
        {(['list', 'map'] as const).map((v) => (
          <button
            key={v}
            role="tab"
            aria-selected={view === v}
            onClick={() => setView(v)}
            className={cx('rounded-full px-4 py-2 text-sm font-semibold', view === v ? 'bg-ink text-white' : 'bg-surface-3 hover:bg-line')}
          >
            {v === 'list' ? 'List' : 'Map'}
          </button>
        ))}
      </div>
      {view === 'list' ? (
        list
      ) : (
        <TrimmyMap
          label={`Map of ${located.length} places`}
          center={center}
          zoom={13}
          fitToPins
          className="h-[70dvh] min-h-96"
          pins={located.map((b) => ({
            id: b.businessId,
            lat: b.lat,
            lng: b.lng,
            label: b.startingPrice?.amount ? `${b.name} · from ${money(b.startingPrice)}` : b.name,
            onClick: () => router.push(`/b/${b.businessId}`),
          }))}
        />
      )}
    </div>
  );
}
