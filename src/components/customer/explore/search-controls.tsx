'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Button, Spinner } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { toast } from '@/components/ui/toast';
import { cx } from '@/lib/format';
import { CATEGORIES } from '../labels';
import { LocateIcon, SearchIcon, SlidersIcon } from '../icons';
import { exploreHref, type ExploreQuery } from './query';

// The same preset pills as the mobile FilterSheet.
const PRICE = [
  { label: 'Any', value: undefined },
  { label: 'Under KSh 1,000', value: 1000 },
  { label: 'Under KSh 2,500', value: 2500 },
  { label: 'Under KSh 5,000', value: 5000 },
];
const RATING = [
  { label: 'Any', value: undefined },
  { label: '3.5+', value: 3.5 },
  { label: '4.0+', value: 4 },
  { label: '4.5+', value: 4.5 },
];
const RADIUS = [
  { label: 'Any', value: undefined },
  { label: '2 km', value: 2 },
  { label: '5 km', value: 5 },
  { label: '10 km', value: 10 },
  { label: '20 km', value: 20 },
];

// Explore's search bar, category pills, filters and "near me". Everything
// lives in the URL, so the server renders the results (and they're shareable).
// `onImage` turns the pills into the landing's glass pills for the sky hero.
export function SearchControls({ query, onImage }: { query: ExploreQuery; onImage?: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [text, setText] = useState(query.q ?? '');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [locating, setLocating] = useState(false);
  const near = query.lat !== undefined && query.lng !== undefined;

  const go = (next: ExploreQuery) => startTransition(() => router.push(exploreHref(next), { scroll: false }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    go({ ...query, q: text.trim() || undefined });
  };

  const toggleNear = () => {
    if (near) {
      go({ ...query, lat: undefined, lng: undefined, radiusKm: undefined });
      return;
    }
    if (!('geolocation' in navigator)) {
      toast.error("Your browser can't share your location.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        // ~1 km precision is plenty for "near me" and keeps the URL (and cache) coarse.
        const round = (n: number) => Math.round(n * 100) / 100;
        go({ ...query, lat: round(pos.coords.latitude), lng: round(pos.coords.longitude) });
      },
      (err) => {
        setLocating(false);
        toast.error(err.code === err.PERMISSION_DENIED ? 'Location access was blocked. Allow it in your browser to search near you.' : "Couldn't find your location.");
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 5 * 60_000 },
    );
  };

  const filterCount = [query.priceMax, query.ratingMin, query.radiusKm].filter((v) => v !== undefined).length;
  const idle = onImage ? 'border-white/30 bg-white/10 text-white hover:bg-white/20' : 'border-line-2 bg-white hover:border-ink';
  const on = onImage ? 'border-white bg-white text-ink' : 'border-ink bg-ink text-white';

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={submit} role="search" className="flex items-center gap-2 rounded-full border border-line-2 bg-white p-1.5 pl-5 shadow-card transition focus-within:border-ink focus-within:ring-4 focus-within:ring-accent-soft">
        <SearchIcon className="size-5 shrink-0 text-ink-2" />
        <label htmlFor="explore-q" className="sr-only">Search salons, barbers and services</label>
        <input
          id="explore-q"
          type="search"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Search salons, barbers or a service like “braids”"
          className="min-w-0 flex-1 bg-transparent py-2 text-[15px] outline-none placeholder:text-ink-3"
        />
        <Button type="submit" variant="brand" className="shrink-0" loading={pending}>
          <span className="hidden sm:inline">Search</span>
          <SearchIcon className="size-4 sm:hidden" />
        </Button>
      </form>

      <div className="flex items-center gap-2 overflow-x-auto pb-1 rounded-full [scrollbar-width:none]">
        <button
          type="button"
          onClick={toggleNear}
          aria-pressed={near}
          className={cx(
            'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-semibold transition-colors',
            near ? on : idle,
          )}
        >
          {locating ? <Spinner className="size-4" /> : <LocateIcon />}
          Near me
        </button>
        <button
          type="button"
          onClick={() => setFiltersOpen(true)}
          className={cx('inline-flex shrink-0 items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-semibold transition-colors', idle)}
        >
          <SlidersIcon />
          Filters
          {filterCount ? <span className="grid size-5 place-items-center rounded-full bg-accent text-xs text-accent-foreground">{filterCount}</span> : null}
        </button>
        <span className={cx('mx-1 h-6 w-px shrink-0', onImage ? 'bg-white/30' : 'bg-line-2')} aria-hidden />
        <CategoryPill onImage={onImage} active={!query.category} onClick={() => go({ ...query, category: undefined })}>
          All
        </CategoryPill>
        {CATEGORIES.map((c) => (
          <CategoryPill key={c.value} onImage={onImage} active={query.category === c.value} onClick={() => go({ ...query, category: query.category === c.value ? undefined : c.value })}>
            {c.label}
          </CategoryPill>
        ))}
      </div>

      <FiltersModal
        open={filtersOpen}
        near={near}
        query={query}
        onClose={() => setFiltersOpen(false)}
        onApply={(f) => {
          setFiltersOpen(false);
          go({ ...query, ...f });
        }}
      />
    </div>
  );
}

function CategoryPill({ active, onImage, onClick, children }: { active: boolean; onImage?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cx(
        'shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-colors',
        onImage
          ? active ? 'bg-accent text-accent-foreground' : 'bg-white/10 text-white hover:bg-white/20'
          : active ? 'bg-ink text-white' : 'bg-ink/[0.04] text-ink hover:bg-accent-soft',
      )}
    >
      {children}
    </button>
  );
}

type Filters = Pick<ExploreQuery, 'priceMax' | 'ratingMin' | 'radiusKm'>;

function FiltersModal({
  open, near, query, onClose, onApply,
}: { open: boolean; near: boolean; query: ExploreQuery; onClose: () => void; onApply: (f: Filters) => void }) {
  // Remounted on open, so the draft always starts from the current filters.
  return open ? <FiltersBody near={near} query={query} onClose={onClose} onApply={onApply} /> : null;
}

function FiltersBody({ near, query, onClose, onApply }: { near: boolean; query: ExploreQuery; onClose: () => void; onApply: (f: Filters) => void }) {
  const [draft, setDraft] = useState<Filters>({ priceMax: query.priceMax, ratingMin: query.ratingMin, radiusKm: query.radiusKm });
  return (
    <Modal
      open
      onClose={onClose}
      title="Filters"
      footer={
        <div className="flex items-center justify-between gap-3">
          <button type="button" className="text-sm font-semibold underline" onClick={() => setDraft({})}>
            Clear all
          </button>
          <Button onClick={() => onApply(draft)}>Show results</Button>
        </div>
      }
    >
      <div className="flex flex-col gap-6 pb-2">
        <PillGroup label="Price" options={PRICE} value={draft.priceMax} onChange={(v) => setDraft((d) => ({ ...d, priceMax: v }))} />
        <PillGroup label="Rating" options={RATING} value={draft.ratingMin} onChange={(v) => setDraft((d) => ({ ...d, ratingMin: v }))} />
        <PillGroup
          label="Distance"
          options={RADIUS}
          value={draft.radiusKm}
          disabled={!near}
          hint={near ? undefined : 'Turn on “Near me” to filter by distance.'}
          onChange={(v) => setDraft((d) => ({ ...d, radiusKm: v }))}
        />
      </div>
    </Modal>
  );
}

function PillGroup({
  label, options, value, onChange, disabled, hint,
}: {
  label: string;
  options: { label: string; value: number | undefined }[];
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  disabled?: boolean;
  hint?: string;
}) {
  return (
    <fieldset disabled={disabled} className="disabled:opacity-50">
      <legend className="mb-2.5 font-bold">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={o.label}
            type="button"
            aria-pressed={value === o.value}
            onClick={() => onChange(o.value)}
            className={cx(
              'rounded-full border px-4 py-2 text-sm font-semibold transition-colors',
              value === o.value ? 'border-ink bg-ink text-white' : 'border-line-2 hover:border-ink',
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
      {hint ? <p className="mt-2 text-[13px] text-ink-2">{hint}</p> : null}
    </fieldset>
  );
}
