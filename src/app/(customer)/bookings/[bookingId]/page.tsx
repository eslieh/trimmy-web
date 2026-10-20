import type { Metadata } from 'next';
import { BookingDetail } from '@/components/customer/bookings/booking-detail';
import { getBookingOr404, getProfile } from '@/components/customer/data';

export const metadata: Metadata = { title: 'Booking details' };

export default async function BookingPage({ params }: PageProps<'/bookings/[bookingId]'>) {
  const { bookingId } = await params;
  const booking = await getBookingOr404(bookingId);
  // The business may have unpublished since: the booking still shows, without location.
  const profile = await getProfile(booking.businessId).catch(() => null);
  return <BookingDetail key={`${booking.bookingId}:${booking.status}`} initial={booking} profile={profile} />;
}
