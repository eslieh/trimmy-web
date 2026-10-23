import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/server/auth';
import { serverApi } from '@/lib/server/api';
import { EmptyState, PageHeader } from '@/components/ui/misc';
import { buttonClass } from '@/components/ui/button';
import { ReviewCard } from '@/components/customer/reviews/review-card';
import type { ReviewPage } from '@/types/discovery';

export const metadata: Metadata = { title: 'My reviews' };

// The reviews you've written, with the businesses' replies. Each links back to its business.
export default async function MyReviewsPage() {
  const session = await getSession();
  if (!session) redirect('/login?next=/account/reviews');
  const data = await serverApi<ReviewPage>('/me/reviews?limit=50');

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="My reviews" eyebrow="Account" subtitle="What you've said about your visits, and what the businesses replied." />
      {data.reviews.length ? (
        <ul className="flex flex-col gap-3">
          {data.reviews.map((r) => (
            <li key={r.reviewId}>
              <Link href={r.businessId ? `/b/${r.businessId}` : '#'} className="block rounded-3xl transition-shadow hover:shadow-card">
                <ReviewCard review={r} showBusiness />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          title="No reviews yet"
          body="After a visit, you can rate it from My bookings."
          action={<Link href="/bookings" className={buttonClass('secondary')}>My bookings</Link>}
        />
      )}
    </div>
  );
}
