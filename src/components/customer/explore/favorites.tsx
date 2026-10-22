'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { api, errorMessage } from '@/lib/api';
import { useSession } from '@/components/session';
import { toast } from '@/components/ui/toast';
import { cx } from '@/lib/format';
import type { Favorites } from '@/types/customer-web';
import { HeartIcon } from '../icons';
import { useLoad } from '../hooks';

type Ctx = { signedIn: boolean; isFavorite: (id: string) => boolean; toggle: (id: string, name: string) => void };
const FavoritesCtx = createContext<Ctx | null>(null);

// The signed-in visitor's saved businesses, loaded once per page in the
// browser (Explore's results are cached and shared, so they can't carry it).
export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const { session } = useSession();
  const userId = session?.user.id ?? null;
  const { data } = useLoad(userId ? `favorites:${userId}` : null, () => api<Favorites>('/me/favorites'));
  // Local flips win over the loaded list until the page reloads.
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const saved = useMemo(() => new Set(data?.businesses.map((b) => b.businessId) ?? []), [data]);

  const isFavorite = useCallback((id: string) => overrides[id] ?? saved.has(id), [overrides, saved]);

  const toggle = useCallback(
    (id: string, name: string) => {
      const next = !(overrides[id] ?? saved.has(id));
      setOverrides((o) => ({ ...o, [id]: next }));
      // PUT / DELETE are idempotent, so the heart flips first and only undoes on failure.
      api(`/me/favorites/businesses/${id}`, { method: next ? 'PUT' : 'DELETE' })
        .then(() => toast(next ? `Saved ${name}` : `Removed ${name} from saved`))
        .catch((err) => {
          setOverrides((o) => ({ ...o, [id]: !next }));
          toast.error(errorMessage(err, "Couldn't update your saved places."));
        });
    },
    [overrides, saved],
  );

  const value = useMemo(() => ({ signedIn: !!userId, isFavorite, toggle }), [userId, isFavorite, toggle]);
  return <FavoritesCtx.Provider value={value}>{children}</FavoritesCtx.Provider>;
}

// `overlay`: Airbnb's bare heart for photos, a white outline over a dark wash.
export function FavoriteButton({ businessId, name, className, overlay }: { businessId: string; name: string; className?: string; overlay?: boolean }) {
  const ctx = useContext(FavoritesCtx);
  if (!ctx?.signedIn) return null;
  const on = ctx.isFavorite(businessId);
  return (
    <button
      type="button"
      onClick={(e) => {
        // The button sits on top of the card's link.
        e.preventDefault();
        e.stopPropagation();
        ctx.toggle(businessId, name);
      }}
      aria-pressed={on}
      aria-label={on ? `Remove ${name} from saved` : `Save ${name}`}
      className={cx(
        'grid size-10 place-items-center rounded-full transition-transform hover:scale-110',
        overlay ? '' : cx('bg-white/95 shadow-card', on ? 'text-brand-pink' : 'text-ink'),
        className,
      )}
    >
      {overlay ? (
        <svg viewBox="0 0 24 24" className={cx('size-7 drop-shadow-sm', on ? 'fill-brand-pink' : 'fill-black/40')} stroke="white" strokeWidth={2} aria-hidden>
          <path d="M12 20.5s-7.5-4.6-9.2-9.4C1.7 7.8 3.9 4.5 7.3 4.5c2 0 3.6 1.1 4.7 2.7 1.1-1.6 2.7-2.7 4.7-2.7 3.4 0 5.6 3.3 4.5 6.6-1.7 4.8-9.2 9.4-9.2 9.4z" />
        </svg>
      ) : (
        <HeartIcon filled={on} />
      )}
    </button>
  );
}
