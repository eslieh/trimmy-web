import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Eyebrow } from '@/components/ui/misc';
import Link from 'next/link';
import { ReviewCard } from '@/components/customer/reviews/review-card';
import { ReportButton } from '@/components/customer/report-button';
import { ButtonLink, buttonClass } from '@/components/ui/button';
import { money } from '@/lib/format';
import { getProfile } from '@/components/customer/data';
import { Gallery } from '@/components/customer/business/gallery';
import { CartPanel, ServiceMenu } from '@/components/customer/business/service-menu';
import { FavoriteButton, FavoritesProvider } from '@/components/customer/explore/favorites';
import { PinIcon, Stars } from '@/components/customer/icons';
import { DAYS, categoryLabel, dayName, hoursLabel, mapsUrl, openNow } from '@/components/customer/labels';
import type { BusinessProfile } from '@/types/discovery';
import { BusinessLocationMap } from '@/components/customer/business/location-map';
import { TeamList } from '@/components/customer/business/team';

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
// it); the gallery, service menu and cart are client islands. Laid out in the
// landing's style: dot labels, tinted tiles, whitespace instead of rules.
export default async function BusinessPage({ params }: PageProps<'/b/[businessId]'>) {
  const { businessId } = await params;
  const profile = await getProfile(businessId);
  if (!profile) notFound();
  const { open, today } = openNow(profile.workingHours, new Date());
  const hasHours = DAYS.some((d) => profile.workingHours[d]);
  const cheapest = profile.services.reduce<BusinessProfile['services'][number] | null>(
    (min, s) => (!min || s.price.amount < min.price.amount ? s : min),
    null,
  );

  return (
    <FavoritesProvider>
      <JsonLd profile={profile} />
      <div className="flex flex-col gap-8 pb-24 lg:pb-0">
        <header className="flex flex-wrap items-end justify-between gap-6 animate-fade-in">
          <div className="min-w-0">
            {profile.categories.length ? <Eyebrow>{profile.categories.map(categoryLabel).join(' · ')}</Eyebrow> : null}
            <h1 className="mt-3 text-4xl leading-[1.1] font-bold tracking-tight sm:text-5xl">{profile.name}</h1>
            <a
              href={mapsUrl(profile.lat, profile.lng, profile.address)}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-1.5 text-ink-2 underline-offset-2 hover:text-ink hover:underline"
            >
              <PinIcon /> {profile.address}
            </a>
          </div>
          <div className="flex items-center gap-3">
            <FavoriteButton businessId={profile.businessId} name={profile.name} className="ring-1 ring-ink/10" />
            {/* Phones have the cart bar's button instead. */}
            <div className="hidden lg:block">
              <ButtonLink href={`/b/${profile.businessId}/book`} variant="brand" arrow>
                Book now
              </ButtonLink>
            </div>
          </div>
        </header>

        <Gallery name={profile.name} photos={profile.photos} />

        {/* Quick facts, in the landing's big-number indicator style. */}
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Fact
            stat={profile.reviewCount > 0 ? profile.rating.toFixed(1) : 'New'}
            caption={profile.reviewCount > 0 ? `${profile.reviewCount === 1 ? '1 review' : `${profile.reviewCount} reviews`}` : 'No reviews yet'}
            href={profile.reviewCount > 0 ? '#reviews' : undefined}
          />
          <Fact
            stat={String(profile.services.length)}
            caption={cheapest ? `Services, from ${money(cheapest.price)}` : 'Services'}
            href="#services"
          />
          {hasHours ? (
            <Fact stat={open ? 'Open' : 'Closed'} caption={`Today · ${hoursLabel(profile.workingHours[today])}`} tone={open ? 'success' : undefined} />
          ) : null}
          {profile.staff.length ? <Fact stat={String(profile.staff.length)} caption={profile.staff.length === 1 ? 'Professional' : 'Professionals'} /> : null}
        </ul>

        <div className="mt-4 grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-14">
          <div className="flex min-w-0 flex-col gap-16">
            {profile.description ? (
              <Section label="About">
                <p className="text-xl leading-relaxed tracking-tight whitespace-pre-line sm:text-2xl sm:leading-snug">{profile.description}</p>
              </Section>
            ) : null}

            <Section label="Services" id="services">
              <ServiceMenu businessId={profile.businessId} services={profile.services} />
            </Section>

            {profile.staff.length ? (
              <Section label="Team">
                <TeamList businessId={profile.businessId} staff={profile.staff} services={profile.services} />
              </Section>
            ) : null}

            <Section label="Reviews" id="reviews">
              {profile.reviews.length ? (
                <>
                  <div className="mb-6 flex items-end gap-4">
                    <p className="text-5xl font-bold text-brand">{profile.rating.toFixed(1)}</p>
                    <div className="pb-1.5">
                      <Stars rating={profile.rating} />
                      <p className="text-sm text-ink-2">{profile.reviewCount === 1 ? '1 review' : `${profile.reviewCount} reviews`}</p>
                    </div>
                  </div>
                  <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {profile.reviews.map((r) => (
                      <li key={r.reviewId} className="flex flex-col gap-1">
                        <ReviewCard review={r} />
                        <ReportButton targetType="review" targetId={r.reviewId} name={`${r.authorName}'s review`} className="self-end text-xs" />
                      </li>
                    ))}
                  </ul>
                  {profile.reviewCount > profile.reviews.length ? (
                    <Link href={`/b/${profile.businessId}/reviews`} className={buttonClass('secondary', 'sm', 'mt-6')}>
                      See all {profile.reviewCount} reviews
                    </Link>
                  ) : null}
                </>
              ) : (
                <p className="rounded-3xl bg-ink/[0.03] p-6 text-ink-2">No reviews yet. Reviews come from customers after a completed visit.</p>
              )}
            </Section>

            {profile.amenities.length ? (
              <Section label="Amenities">
                <ul className="flex flex-wrap gap-2">
                  {profile.amenities.map((a) => (
                    <li key={a} className="flex items-center gap-2 rounded-full bg-ink/[0.04] px-4 py-2 text-sm font-medium">
                      <span className="size-1.5 rounded-full bg-brand-pink" aria-hidden />
                      {a}
                    </li>
                  ))}
                </ul>
              </Section>
            ) : null}

            <div className="grid grid-cols-1 gap-16 md:grid-cols-2 md:gap-8">
              <Section label="Opening hours">
                {hasHours ? (
                  <dl className="flex flex-col gap-1 rounded-3xl bg-ink/[0.03] p-3">
                    {DAYS.map((d) => (
                      <div key={d} className={`flex justify-between gap-4 rounded-2xl px-3 py-2 ${d === today ? 'bg-accent-soft font-semibold text-accent-foreground' : ''}`}>
                        <dt>{dayName(d)}</dt>
                        <dd className={profile.workingHours[d] || d === today ? '' : 'text-ink-3'}>{hoursLabel(profile.workingHours[d])}</dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  <p className="rounded-3xl bg-ink/[0.03] p-6 text-ink-2">Hours not listed. Available times show when you book.</p>
                )}
              </Section>
              <Section label="Location">
                <p className="text-ink-2">{profile.address}</p>
                <div className="overflow-hidden rounded-3xl">
                  <BusinessLocationMap lat={profile.lat} lng={profile.lng} name={profile.name} />
                </div>
                <a
                  href={mapsUrl(profile.lat, profile.lng, profile.address)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={buttonClass('secondary', 'sm', 'mt-4')}
                >
                  <PinIcon /> Open in Google Maps
                </a>
              </Section>
            </div>

            <Section label="Policies">
              <ul className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Policy title="Deposit">{profile.depositSummary}</Policy>
                <Policy title="Cancellation">{profile.cancellationSummary}</Policy>
                <Policy title="No-shows">
                  {profile.policies.noShow.feePercent > 0
                    ? `If you miss your appointment without cancelling, the business may charge ${profile.policies.noShow.feePercent}% of the booking total (taken from any deposit you paid).`
                    : "There's no fee for missed appointments, but please cancel if you can't make it."}
                </Policy>
              </ul>
            </Section>
            <ReportButton targetType="business" targetId={profile.businessId} name={profile.name} label="Report this business" className="self-start" />
          </div>

          <aside className="lg:sticky lg:top-24 lg:self-start">
            <CartPanel businessId={profile.businessId} services={profile.services} depositSummary={profile.depositSummary} />
          </aside>
        </div>
      </div>
    </FavoritesProvider>
  );
}

function Fact({ stat, caption, href, tone }: { stat: string; caption: string; href?: string; tone?: 'success' }) {
  const body = (
    <>
      <p className={`text-3xl font-bold tracking-tight sm:text-4xl ${tone === 'success' ? 'text-success' : 'text-brand'}`}>{stat}</p>
      <p className="mt-1 text-sm text-ink-2">{caption}</p>
    </>
  );
  const tile = 'block h-full rounded-3xl bg-ink/[0.03] p-5 transition-colors';
  return <li>{href ? <a href={href} className={`${tile} hover:bg-accent-soft/60`}>{body}</a> : <div className={tile}>{body}</div>}</li>;
}

// The landing's section shape: a dot label as the heading, then the content.
function Section({ label, id, children }: { label: string; id?: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={id ? `${id}-h` : undefined} className="scroll-mt-24">
      <h2 id={id ? `${id}-h` : undefined} className="mb-5">
        <Eyebrow>{label}</Eyebrow>
      </h2>
      {children}
    </section>
  );
}

function Policy({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <li className="rounded-3xl bg-ink/[0.03] p-5">
      <p className="text-sm font-semibold tracking-wide uppercase">{title}</p>
      <p className="mt-2 text-sm leading-6 text-ink-2">{children}</p>
    </li>
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
