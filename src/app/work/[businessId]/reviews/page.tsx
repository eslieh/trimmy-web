import type { Metadata } from 'next';
import { ReviewsView } from '@/components/work-manage/reviews';

export const metadata: Metadata = { title: 'Reviews' };

// Owner and front desk: read and reply to reviews.
export default function ReviewsPage() {
  return <ReviewsView />;
}
