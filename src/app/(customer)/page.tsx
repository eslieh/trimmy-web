import Link from 'next/link';
import { serverApi } from '@/lib/server/api';
import { EmptyState } from '@/components/ui/misc';
import { buttonClass } from '@/components/ui/button';
import { BusinessCard } from '@/components/customer/explore/business-card';
import { ResultsView } from '@/components/customer/explore/results-view';
import { FavoritesProvider } from '@/components/customer/explore/favorites';
import { SearchControls } from '@/components/customer/explore/search-controls';
import { exploreHref, type ExploreQuery } from '@/components/customer/explore/query';
import { CATEGORIES, categoryLabel, firstParam } from '@/components/customer/labels';
import type { SearchResponse } from '@/types/customer-web';

function num(value: string | string[] | undefined): number | undefined {
  const n = Number(firstParam(value));
  return firstParam(value) !== undefined && Number.isFinite(n) ? n : undefined;
}

// Explore: rendered on the server from the URL (search engines and shared
// links see real results); the search bar, filters and hearts are islands.
export default async function ExplorePage({ searchParams }: PageProps<'/'>) {
  const params = await searchParams;
  const category = firstParam(params.category);
  const query: ExploreQuery = {
    q: firstParam(params.q)?.trim() || undefined,
    category: CATEGORIES.some((c) => c.value === category) ? category : undefined,
    priceMax: num(params.priceMax),
    ratingMin: num(params.ratingMin),
    lat: num(params.lat),
    lng: num(params.lng),
  };
  const near = query.lat !== undefined && query.lng !== undefined;
  // Distance only means something from a point.
  if (near) query.radiusKm = num(params.radiusKm);

  let businesses: SearchResponse['businesses'] | null = null;
  try {
    const { lat, lng, q, ...rest } = query;
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries({ query: q, lat, lng, ...rest })) if (v !== undefined) qs.set(k, String(v));
    businesses = (await serverApi<SearchResponse>(`/businesses/search?${qs}`, { auth: false, revalidate: 60 })).businesses;
  } catch {
    businesses = null;
  }

  const filtered = !!(query.q || query.category || query.priceMax || query.ratingMin || query.radiusKm);
  const heading = query.q
    ? `Results for “${query.q}”`
    : query.category
      ? `${categoryLabel(query.category)}s${near ? ' near you' : ''}`
      : near
        ? 'Near you'
        : 'Popular on Trimmy';

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-5">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
            Book salons and barbers <span className="text-brand-gradient">near you</span>
          </h1>
          <p className="mt-2 max-w-2xl text-ink-2 sm:text-lg">See real availability, pay a deposit with M-Pesa when needed, and walk in on time.</p>
        </div>
        <SearchControls key={query.q ?? ''} query={query} />
      </section>

      <section aria-labelledby="results-heading">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="results-heading" className="text-xl font-bold">{heading}</h2>
          {businesses ? (
            <p className="text-sm text-ink-2" aria-live="polite">
              {businesses.length === 1 ? '1 place' : `${businesses.length} places`}
            </p>
          ) : null}
        </div>

        {businesses === null ? (
          <EmptyState
            title="Couldn't load places"
            body="Something went wrong on our side. Please try again in a moment."
            action={<Link href={exploreHref(query)} className={buttonClass('secondary')}>Try again</Link>}
          />
        ) : businesses.length === 0 ? (
          <EmptyState
            title="No places match"
            body={filtered ? 'Try a different search, or clear some filters.' : 'No businesses are taking bookings here yet. Check back soon.'}
            action={filtered ? <Link href={near ? exploreHref({ lat: query.lat, lng: query.lng }) : '/'} className={buttonClass('secondary')}>Clear filters</Link> : null}
          />
        ) : (
          <FavoritesProvider>
            <ResultsView
              businesses={businesses}
              list={
                <ul className="grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {businesses.map((b, i) => (
                    <li key={b.businessId}>
                      <BusinessCard business={b} priority={i < 4} />
                    </li>
                  ))}
                </ul>
              }
            />
          </FavoritesProvider>
        )}
      </section>
    </div>
  );
}
