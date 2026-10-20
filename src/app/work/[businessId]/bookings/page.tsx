import type { Metadata } from 'next';
import { BookingsView } from '@/components/work-daily/bookings-view';

export const metadata: Metadata = { title: 'Bookings' };

// ?tab=unassigned|refunds opens a queue directly (e.g. from a notification).
export default async function BookingsPage({ searchParams }: PageProps<'/work/[businessId]/bookings'>) {
  const { tab } = await searchParams;
  const t = Array.isArray(tab) ? tab[0] : tab;
  return <BookingsView initialTab={t === 'unassigned' || t === 'refunds' ? t : 'all'} />;
}
