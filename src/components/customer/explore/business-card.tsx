import Link from 'next/link';
import { money } from '@/lib/format';
import type { BusinessSummary } from '@/types/discovery';
import { categoryLabel } from '../labels';
import { StarIcon } from '../icons';
import { Photo } from '../photo';
import { FavoriteButton } from './favorites';

// One search result: cover photo, name, rating, area, "from" price.
export function BusinessCard({ business, priority }: { business: BusinessSummary; priority?: boolean }) {
  const cover = business.thumbnailUrl || business.photos[0];
  // The street address's first part reads as the area ("Kilimani, Nairobi" → "Kilimani").
  const area = business.address.split(',').slice(0, 2).join(',').trim();
  return (
    <div className="group relative">
      <Link href={`/b/${business.businessId}`} className="block rounded-card focus-visible:outline-offset-4">
        <div className="relative aspect-[4/3] overflow-hidden rounded-card bg-surface-3">
          <Photo
            src={cover}
            alt={`${business.name}`}
            name={business.name}
            priority={priority}
            sizes="(min-width: 1280px) 25vw, (min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            className="transition-transform duration-300 group-hover:scale-[1.03]"
          />
          {business.categories[0] ? (
            <span className="absolute bottom-3 left-3 rounded-full bg-white/90 px-2.5 py-1 text-xs font-semibold backdrop-blur">
              {categoryLabel(business.categories[0])}
            </span>
          ) : null}
        </div>
        <div className="mt-3 flex items-start justify-between gap-3">
          <h3 className="line-clamp-1 font-bold">{business.name}</h3>
          {business.reviewCount > 0 ? (
            <span className="flex shrink-0 items-center gap-1 text-sm font-semibold">
              <StarIcon className="size-3.5" />
              {business.rating.toFixed(1)}
              <span className="font-normal text-ink-2">({business.reviewCount})</span>
            </span>
          ) : (
            <span className="shrink-0 text-sm font-semibold text-brand">New</span>
          )}
        </div>
        <p className="line-clamp-1 text-sm text-ink-2">
          {area}
          {business.distanceKm ? ` · ${business.distanceKm} km away` : ''}
        </p>
        {business.startingPrice ? (
          <p className="mt-1 text-sm">
            From <span className="font-bold">{money(business.startingPrice)}</span>
          </p>
        ) : null}
      </Link>
      <FavoriteButton businessId={business.businessId} name={business.name} className="absolute top-3 right-3" />
    </div>
  );
}

export function BusinessCardSkeleton() {
  return (
    <div aria-hidden className="animate-pulse">
      <div className="aspect-[4/3] rounded-card bg-surface-3" />
      <div className="mt-3 h-4 w-2/3 rounded bg-surface-3" />
      <div className="mt-2 h-3 w-1/2 rounded bg-surface-3" />
      <div className="mt-2 h-3 w-1/3 rounded bg-surface-3" />
    </div>
  );
}
