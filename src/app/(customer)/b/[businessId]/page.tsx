import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Avatar, Badge } from '@/components/ui/misc';
import { relativeTime } from '@/lib/format';
import { getProfile } from '@/components/customer/data';
import { Gallery } from '@/components/customer/business/gallery';
import { CartPanel, ServiceMenu } from '@/components/customer/business/service-menu';
import { FavoriteButton, FavoritesProvider } from '@/components/customer/explore/favorites';
import { PinIcon, StarIcon, Stars } from '@/components/customer/icons';
import { DAYS, categoryLabel, dayName, hoursLabel, mapsUrl, openNow } from '@/components/customer/labels';
import type { BusinessProfile } from '@/types/discovery';

export async function generateMetadata({ params }: PageProps<'/b/[businessId]'>): Promise<Metadata> {
  const profile = await getProfile((await params).businessId).catch(() => null);
  if (!profile) return { title: 'Business not found' };
  const kind = profile.categories.map(categoryLabel).join(', ');
  const description =
    profile.description.slice(0, 160) || `Book ${profile.name}${kind ? ` (${kind})` : ''} at ${profile.address} on Trimmy.`;
  return {
    title: profile.name,
    description,
    openGraph: { title: profile.name, description, images: profile.photos.slice(0, 1) },
  };
}

// A business's public profile: rendered on the server (search engines read
// it); the gallery, service menu and cart are client islands.
export default async function BusinessPage({ params }: PageProps<'/b/[businessId]'>) {
  const { businessId } = await params;
  const profile = await getProfile(businessId);
  if (!profile) notFound();
  const { open, today } = openNow(profile.workingHours, new Date());
  const hasHours = DAYS.some((d) => profile.workingHours[d]);

  return (
    <FavoritesProvider>
      <JsonLd profile={profile} />
      <div className="flex flex-col gap-6 pb-24 lg:pb-0">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{profile.name}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[15px]">
              {profile.reviewCount > 0 ? (
                <a href="#reviews" className="flex items-center gap-1 font-semibold hover:underline">
                  <StarIcon className="size-4" />
                  {profile.rating.toFixed(1)} <span className="font-normal text-ink-2">· {profile.reviewCount} reviews</span>
                </a>
              ) : (
                <span className="font-semibold text-brand">New on Trimmy</span>
              )}
              <span className="text-ink-3" aria-hidden>·</span>
              <span className="text-ink-2">{profile.categories.map(categoryLabel).join(' · ')}</span>
              {hasHours ? (
                <>
                  <span className="text-ink-3" aria-hidden>·</span>
                  <Badge tone={open ? 'success' : 'neutral'}>{open ? 'Open now' : 'Closed now'}</Badge>
                </>
              ) : null}
            </div>
            <a href={mapsUrl(profile.lat, profile.lng, profile.address)} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-[15px] text-ink-2 underline-offset-2 hover:underline">
              <PinIcon /> {profile.address}
            </a>
          </div>
          <FavoriteButton businessId={profile.businessId} name={profile.name} className="border border-line" />
        </header>

        <Gallery name={profile.name} photos={profile.photos} />

        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-14">
          <div className="flex min-w-0 flex-col gap-10">
            {profile.description ? (
              <Section title="About">
                <p className="whitespace-pre-line leading-relaxed text-ink">{profile.description}</p>
              </Section>
            ) : null}

            <Section title="Services" id="services">
              <ServiceMenu businessId={profile.businessId} services={profile.services} />
            </Section>

            {profile.staff.length ? (
              <Section title="Team">
                <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {profile.staff.map((s) => (
                    <li key={s.staffId} className="flex gap-3 rounded-card border border-line p-4">
                      <Avatar name={s.name} src={s.avatarUrl} size={52} />
                      <div className="min-w-0">
                        <p className="font-bold">{s.name}</p>
                        <p className="text-sm capitalize text-ink-2">
                          {s.role.replace(/_/g, ' ')}
                          {s.rating > 0 ? (
                            <span className="ml-2 inline-flex items-center gap-0.5 font-semibold text-ink normal-case">
                              <StarIcon className="size-3" /> {s.rating.toFixed(1)}
                            </span>
                          ) : null}
                        </p>
                        {s.specialties.length ? <p className="mt-1 line-clamp-2 text-sm text-ink-2">{s.specialties.join(' · ')}</p> : null}
                        {s.bio ? <p className="mt-1 line-clamp-3 text-sm">{s.bio}</p> : null}
                      </div>
                    </li>
                  ))}
                </ul>
              </Section>
            ) : null}

            <Section title={profile.reviewCount ? `Reviews · ${profile.rating.toFixed(1)} (${profile.reviewCount})` : 'Reviews'} id="reviews">
              {profile.reviews.length ? (
                <>
                  <ReviewList reviews={profile.reviews.slice(0, 6)} />
                  {profile.reviews.length > 6 ? (
                    <details className="mt-6">
                      <summary className="cursor-pointer font-semibold underline">Show all {profile.reviews.length} reviews</summary>
                      <div className="mt-6">
                        <ReviewList reviews={profile.reviews.slice(6)} />
                      </div>
                    </details>
                  ) : null}
                </>
              ) : (
                <p className="text-ink-2">No reviews yet. Reviews come from customers after a completed visit.</p>
              )}
            </Section>

            {profile.amenities.length ? (
              <Section title="Amenities">
                <ul className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
                  {profile.amenities.map((a) => (
                    <li key={a} className="flex items-center gap-2">
                      <span className="size-1.5 rounded-full bg-brand" aria-hidden />
                      {a}
                    </li>
                  ))}
                </ul>
              </Section>
            ) : null}

            <div className="grid grid-cols-1 gap-10 md:grid-cols-2">
              <Section title="Opening hours">
                {hasHours ? (
                  <dl className="flex flex-col gap-1.5">
                    {DAYS.map((d) => (
                      <div key={d} className={`flex justify-between gap-4 ${d === today ? 'font-bold' : ''}`}>
                        <dt>{dayName(d)}</dt>
                        <dd className={profile.workingHours[d] ? '' : 'text-ink-2'}>{hoursLabel(profile.workingHours[d])}</dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  <p className="text-ink-2">Hours not listed. Available times show when you book.</p>
                )}
              </Section>
              <Section title="Location">
                <p>{profile.address}</p>
                <a
                  href={mapsUrl(profile.lat, profile.lng, profile.address)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-line-2 px-4 py-2 text-sm font-semibold hover:border-ink"
                >
                  <PinIcon /> Open in Google Maps
                </a>
              </Section>
            </div>

            <Section title="Policies">
              <ul className="flex flex-col gap-3">
                <Policy title="Deposit">{profile.depositSummary}</Policy>
                <Policy title="Cancellation">{profile.cancellationSummary}</Policy>
                <Policy title="No-shows">
                  {profile.policies.noShow.feePercent > 0
                    ? `If you miss your appointment without cancelling, the business may charge ${profile.policies.noShow.feePercent}% of the booking total (taken from any deposit you paid).`
                    : "There's no fee for missed appointments, but please cancel if you can't make it."}
                </Policy>
              </ul>
            </Section>
          </div>

          <aside className="lg:sticky lg:top-24 lg:self-start">
            <CartPanel businessId={profile.businessId} services={profile.services} depositSummary={profile.depositSummary} />
          </aside>
        </div>
      </div>
    </FavoritesProvider>
  );
}

function Section({ title, id, children }: { title: string; id?: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={id ? `${id}-h` : undefined} className="scroll-mt-24 border-t border-line pt-8 first:border-t-0 first:pt-0">
      <h2 id={id ? `${id}-h` : undefined} className="mb-4 text-xl font-bold">{title}</h2>
      {children}
    </section>
  );
}

function Policy({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <li className="rounded-xl bg-surface-2 p-4">
      <p className="font-semibold">{title}</p>
      <p className="mt-0.5 text-[15px] text-ink-2">{children}</p>
    </li>
  );
}

function ReviewList({ reviews }: { reviews: BusinessProfile['reviews'] }) {
  return (
    <ul className="grid grid-cols-1 gap-x-10 gap-y-8 md:grid-cols-2">
      {reviews.map((r) => (
        <li key={r.reviewId}>
          <div className="flex items-center gap-3">
            <Avatar name={r.authorName} size={40} />
            <div>
              <p className="font-semibold">{r.authorName}</p>
              <p className="text-sm text-ink-2">{relativeTime(r.createdAt)}</p>
            </div>
          </div>
          <div className="mt-2">
            <Stars rating={r.rating} className="size-3.5" />
          </div>
          {r.text ? <p className="mt-1.5 leading-relaxed">{r.text}</p> : null}
        </li>
      ))}
    </ul>
  );
}

// Structured data so search results can show the rating and address.
function JsonLd({ profile }: { profile: BusinessProfile }) {
  const type = profile.categories.includes('barbershop') || profile.categories.includes('hair_salon') ? 'HairSalon' : profile.categories.includes('nail_salon') ? 'NailSalon' : profile.categories.includes('spa') ? 'DaySpa' : 'BeautySalon';
  const data = {
    '@context': 'https://schema.org',
    '@type': type,
    name: profile.name,
    description: profile.description || undefined,
    image: profile.photos.slice(0, 3),
    address: profile.address,
    geo: profile.lat || profile.lng ? { '@type': 'GeoCoordinates', latitude: profile.lat, longitude: profile.lng } : undefined,
    aggregateRating: profile.reviewCount ? { '@type': 'AggregateRating', ratingValue: profile.rating, reviewCount: profile.reviewCount } : undefined,
  };
  // "<" escaped so a business's text can't close the script tag.
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }} />;
}
