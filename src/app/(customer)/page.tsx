import Image from 'next/image';
import Link from 'next/link';
import { serverApi } from '@/lib/server/api';
import { EmptyState, Eyebrow } from '@/components/ui/misc';
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
      {/* The landing's sky hero. The AVIF is ~26 KB and next/image serves it sized to the screen. */}
      <section className="relative overflow-hidden rounded-[2rem]">
        <Image src="/sky.avif" alt="" fill priority sizes="(min-width: 1280px) 1232px, 100vw" className="object-cover object-top" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/15 via-transparent to-black/10" aria-hidden />
        <div className="relative mx-auto flex max-w-3xl flex-col items-center px-5 py-14 text-center sm:py-20">
          <h1 className="text-4xl leading-[1.1] font-bold tracking-tight text-white sm:text-5xl md:text-6xl">
            Book salons and barbers
            <br />
            <span className="text-accent">near you</span>
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-balance text-white/85 sm:text-lg">
            See real availability, pay a deposit with M-Pesa when needed, and walk in on time.
          </p>
          <div className="mt-8 w-full text-left">
            <SearchControls key={query.q ?? ''} query={query} onImage />
          </div>
        </div>
      </section>

      <section aria-labelledby="results-heading">
        <Eyebrow className="mb-3">Explore</Eyebrow>
        <div className="mb-6 flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="results-heading" className="text-3xl leading-tight tracking-tight">{heading}</h2>
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
                <ul className="grid grid-cols-1 gap-x-5 gap-y-9 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
