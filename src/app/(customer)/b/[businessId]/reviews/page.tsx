import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { buttonClass } from '@/components/ui/button';
import { Eyebrow } from '@/components/ui/misc';
import { getProfile } from '@/components/customer/data';
import { Stars } from '@/components/customer/icons';
import { ReviewCard } from '@/components/customer/reviews/review-card';
import { serverApi } from '@/lib/server/api';
import type { ReviewPage } from '@/types/discovery';

const PAGE_SIZE = 20;

export async function generateMetadata({ params }: PageProps<'/b/[businessId]/reviews'>): Promise<Metadata> {
  const profile = await getProfile((await params).businessId).catch(() => null);
  return { title: profile ? `Reviews of ${profile.name}` : 'Reviews' };
}

// Every review of a business, newest first, paged with ?page=. Public and
// server-rendered (cached a minute, like the profile).
export default async function BusinessReviewsPage({ params, searchParams }: PageProps<'/b/[businessId]/reviews'>) {
  const { businessId } = await params;
  const raw = (await searchParams).page;
  const page = Math.max(1, Number(Array.isArray(raw) ? raw[0] : raw) || 1);
  const profile = await getProfile(businessId);
  if (!profile) notFound();
  const data = await serverApi<ReviewPage>(
    `/businesses/${encodeURIComponent(businessId)}/reviews?limit=${PAGE_SIZE}&offset=${(page - 1) * PAGE_SIZE}`,
    { auth: false, revalidate: 60 },
  );
  const pages = Math.max(1, Math.ceil(data.total / PAGE_SIZE));
  const href = (p: number) => `/b/${businessId}/reviews${p > 1 ? `?page=${p}` : ''}`;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8">
      <div>
        <Link href={`/b/${businessId}`} className="text-sm font-semibold text-ink-2 hover:text-ink">← {profile.name}</Link>
        <Eyebrow className="mt-4">Reviews</Eyebrow>
        <h1 className="mt-3 text-4xl leading-tight font-bold tracking-tight">What people say about {profile.name}</h1>
        {data.total ? (
          <div className="mt-4 flex items-end gap-4">
            <p className="text-5xl font-bold text-brand">{data.averageRating.toFixed(1)}</p>
            <div className="pb-1.5">
              <Stars rating={data.averageRating} />
              <p className="text-sm text-ink-2">{data.total === 1 ? '1 review' : `${data.total} reviews`}</p>
            </div>
          </div>
        ) : null}
      </div>

      {data.reviews.length ? (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {data.reviews.map((r) => (
            <li key={r.reviewId}>
              <ReviewCard review={r} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-3xl bg-ink/[0.03] p-6 text-ink-2">No reviews yet.</p>
      )}

      {pages > 1 ? (
        <nav className="flex items-center justify-between" aria-label="Pages">
          {page > 1 ? <Link href={href(page - 1)} className={buttonClass('secondary', 'sm')}>Newer</Link> : <span />}
          <span className="text-sm text-ink-2">Page {page} of {pages}</span>
          {page < pages ? <Link href={href(page + 1)} className={buttonClass('secondary', 'sm')}>Older</Link> : <span />}
        </nav>
      ) : null}
    </div>
  );
}
