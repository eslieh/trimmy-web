import type { Metadata } from 'next';
import { PageHeader } from '@/components/ui/misc';
import { BookingsList } from '@/components/customer/bookings/bookings-list';
import { firstParam } from '@/components/customer/labels';
import type { MyBookingsFilter } from '@/types/customer-web';

export const metadata: Metadata = { title: 'My bookings' };

// Signed-out visitors never get here (proxy.ts sends them to /login).
export default async function BookingsPage({ searchParams }: PageProps<'/bookings'>) {
  const tab = firstParam((await searchParams).tab);
  const initial: MyBookingsFilter = tab === 'past' || tab === 'cancelled' ? tab : 'upcoming';
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="My bookings" subtitle="Your appointments, past and upcoming." />
      <BookingsList initialTab={initial} />
    </div>
  );
}
