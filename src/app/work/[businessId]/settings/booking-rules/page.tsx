import type { Metadata } from 'next';
import { requireOwner } from '@/lib/server/auth';
import { BookingRulesSettings } from '@/components/work-manage/settings/booking-rules';

export const metadata: Metadata = { title: 'Booking rules' };

export default async function Page({ params }: PageProps<'/work/[businessId]/settings/booking-rules'>) {
  const { businessId } = await params;
  await requireOwner(businessId);
  return <BookingRulesSettings />;
}
