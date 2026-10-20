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

export function FavoriteButton({ businessId, name, className }: { businessId: string; name: string; className?: string }) {
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
        'grid size-10 place-items-center rounded-full bg-white/90 shadow-card backdrop-blur transition-transform hover:scale-105',
        on ? 'text-brand-pink' : 'text-ink',
        className,
      )}
    >
      <HeartIcon filled={on} />
    </button>
  );
}
