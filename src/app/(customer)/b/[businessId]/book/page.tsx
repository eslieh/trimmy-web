import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { getSession } from '@/lib/server/auth';
import { ServerApiError, serverApi } from '@/lib/server/api';
import { BookingFlow } from '@/components/customer/booking/booking-flow';
import { getProfile } from '@/components/customer/data';
import { firstParam } from '@/components/customer/labels';
import type { Booking } from '@/types/booking';

export const metadata: Metadata = { title: 'Book', robots: { index: false } };

// Booking needs an account (proxy.ts doesn't guard /b, so it's checked here).
// ?booking=<id> reopens a booking still waiting for its deposit.
export default async function BookPage({ params, searchParams }: PageProps<'/b/[businessId]/book'>) {
  const { businessId } = await params;
  const bookingId = firstParam((await searchParams).booking);
  const session = await getSession();
  if (!session) {
    const here = `/b/${businessId}/book${bookingId ? `?booking=${encodeURIComponent(bookingId)}` : ''}`;
    redirect(`/login?next=${encodeURIComponent(here)}`);
  }
  const profile = await getProfile(businessId);
  if (!profile) notFound();

  let resume: Booking | null = null;
  if (bookingId) {
    resume = await serverApi<Booking>(`/bookings/${encodeURIComponent(bookingId)}`).catch((err) => {
      if (err instanceof ServerApiError) return null;
      throw err;
    });
    if (resume && resume.businessId !== businessId) resume = null;
    if (resume && resume.status !== 'pending_payment') {
      redirect(resume.status === 'confirmed' ? `/b/${businessId}/book/confirmed?booking=${resume.bookingId}` : `/bookings/${resume.bookingId}`);
    }
  }

  return <BookingFlow profile={profile} userPhone={session.user.phone} resume={resume} />;
}
