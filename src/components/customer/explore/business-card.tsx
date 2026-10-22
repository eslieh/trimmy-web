import Link from 'next/link';
import { money } from '@/lib/format';
import type { BusinessSummary } from '@/types/discovery';
import { categoryLabel } from '../labels';
import { StarIcon } from '../icons';
import { Photo } from '../photo';
import { FavoriteButton } from './favorites';

// One search result, Airbnb-style: a big, very round photo with a bare heart
// on it, then the name and a quiet grey line or two. No frame around it.
export function BusinessCard({ business, priority }: { business: BusinessSummary; priority?: boolean }) {
  const cover = business.thumbnailUrl || business.photos[0];
  // The street address's first part reads as the area ("Kilimani, Nairobi" → "Kilimani").
  const area = business.address.split(',').slice(0, 2).join(',').trim();
  const kind = business.categories[0] ? categoryLabel(business.categories[0]) : null;
  return (
    <div className="group relative">
      <Link href={`/b/${business.businessId}`} className="block rounded-3xl focus-visible:outline-offset-4">
        <div className="relative aspect-[20/19] overflow-hidden rounded-3xl bg-surface-3">
          <Photo
            src={cover}
            alt={`${business.name}`}
            name={business.name}
            priority={priority}
            sizes="(min-width: 1280px) 25vw, (min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            className="transition-transform duration-500 group-hover:scale-[1.03]"
          />
          {business.reviewCount === 0 ? (
            <span className="absolute top-3.5 left-3.5 rounded-full bg-white px-3 py-1 text-xs font-semibold shadow-sm">New on Trimmy</span>
          ) : null}
        </div>
        <h3 className="mt-3 line-clamp-2 text-[17px] leading-snug font-semibold tracking-tight">{business.name}</h3>
        <p className="mt-0.5 line-clamp-1 text-[15px] text-ink-2">
          {[kind, area, business.distanceKm ? `${business.distanceKm} km` : null].filter(Boolean).join(' · ')}
        </p>
        <p className="line-clamp-1 text-[15px] text-ink-2">
          {business.startingPrice ? <>From {money(business.startingPrice)}</> : 'See services'}
          {business.reviewCount > 0 ? (
            <>
              <span aria-hidden> · </span>
              <StarIcon className="inline size-3.5 -translate-y-px text-ink" /> {business.rating.toFixed(1)}
              <span className="sr-only"> stars from {business.reviewCount} reviews</span>
            </>
          ) : null}
        </p>
      </Link>
      <FavoriteButton businessId={business.businessId} name={business.name} overlay className="absolute top-2 right-2" />
    </div>
  );
}

export function BusinessCardSkeleton() {
  return (
    <div aria-hidden className="animate-pulse">
      <div className="aspect-[20/19] rounded-3xl bg-ink/[0.06]" />
      <div className="mt-3 h-4 w-2/3 rounded bg-ink/[0.06]" />
      <div className="mt-2 h-3 w-1/2 rounded bg-ink/[0.06]" />
      <div className="mt-2 h-3 w-1/3 rounded bg-ink/[0.06]" />
    </div>
  );
}
