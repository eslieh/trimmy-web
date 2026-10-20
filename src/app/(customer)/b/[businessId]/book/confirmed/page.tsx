import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { getSession } from '@/lib/server/auth';
import { ButtonLink } from '@/components/ui/button';
import { dayLabel, timeLabel } from '@/lib/format';
import { BookingMoney } from '@/components/customer/booking/booking-money';
import { getBookingOr404, getProfile } from '@/components/customer/data';
import { CheckIcon, PinIcon } from '@/components/customer/icons';
import { firstParam, mapsUrl, minutesLabel } from '@/components/customer/labels';

export const metadata: Metadata = { title: 'Booking confirmed', robots: { index: false } };

export default async function ConfirmedPage({ params, searchParams }: PageProps<'/b/[businessId]/book/confirmed'>) {
  const { businessId } = await params;
  const bookingId = firstParam((await searchParams).booking);
  if (!(await getSession())) redirect(`/login?next=${encodeURIComponent(`/bookings${bookingId ? `/${bookingId}` : ''}`)}`);
  if (!bookingId) notFound();
  const booking = await getBookingOr404(bookingId);
  if (booking.status === 'pending_payment') redirect(`/b/${businessId}/book?booking=${booking.bookingId}`);
  const profile = await getProfile(booking.businessId).catch(() => null);

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="grid size-16 place-items-center rounded-full bg-success/10 text-success">
          <CheckIcon className="size-8" />
        </span>
        <h1 className="text-3xl font-extrabold tracking-tight">You&apos;re booked!</h1>
        <p className="text-ink-2">
          {booking.businessName} is expecting you. We&apos;ll remind you before your appointment.
        </p>
        {booking.reference ? (
          <p className="rounded-full bg-surface-3 px-4 py-1.5 text-sm">
            Booking ref <span className="font-mono font-bold">{booking.reference}</span>
          </p>
        ) : null}
      </div>

      <div className="rounded-card border border-line p-6 shadow-card">
        <p className="text-lg font-bold">{dayLabel(booking.date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
        <p className="text-ink-2">
          {timeLabel(booking.time)} · {minutesLabel(booking.durationMinutes)} · with {booking.staffName}
        </p>
        {profile ? (
          <a href={mapsUrl(profile.lat, profile.lng, profile.address)} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-[15px] underline-offset-2 hover:underline">
            <PinIcon /> {profile.address}
          </a>
        ) : null}
        <div className="mt-5 border-t border-line pt-5">
          <BookingMoney booking={booking} />
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <ButtonLink href={`/bookings/${booking.bookingId}`} className="flex-1">View booking</ButtonLink>
        <ButtonLink href="/" variant="secondary" className="flex-1">Explore more</ButtonLink>
      </div>
    </div>
  );
}
