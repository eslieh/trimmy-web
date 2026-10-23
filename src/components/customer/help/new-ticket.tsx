'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Select, Textarea } from '@/components/ui/field';
import { api, errorMessage } from '@/lib/api';
import { cx, dayLabel, timeLabel } from '@/lib/format';
import type { Booking } from '@/types/booking';
import type { MyBookingsPage } from '@/types/customer-web';
import { CATEGORY_LABEL, type Ticket, type TicketCategory } from '@/types/support';

const ABOUT_A_BOOKING: TicketCategory[] = ['booking', 'payment', 'refund'];

// Ask Trimmy's team. ?bookingId= (from a booking) or ?businessId= (from the business area)
// attaches it, so the team knows exactly what it's about.
export function NewTicketForm({
  bookingId: fromBooking, businessId: fromBusiness, businesses,
}: { bookingId: string | null; businessId: string | null; businesses: { id: string; name: string }[] }) {
  const router = useRouter();
  const [category, setCategory] = useState<TicketCategory>(fromBusiness ? 'business' : 'booking');
  const [bookingId, setBookingId] = useState<string | null>(fromBooking);
  const [businessId, setBusinessId] = useState<string | null>(fromBusiness);
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [message, setMessage] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      api<MyBookingsPage>('/me/bookings?filter=upcoming&limit=5'),
      api<MyBookingsPage>('/me/bookings?filter=past&limit=5'),
    ]).then(([a, b]) => setBookings([...a.bookings, ...b.bookings]), () => setBookings([]));
  }, []);

  const topics: TicketCategory[] = businesses.length
    ? ['booking', 'payment', 'refund', 'business', 'account', 'bug', 'other']
    : ['booking', 'payment', 'refund', 'account', 'bug', 'other'];

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return setError('Tell us what happened.');
    setBusy(true);
    setError('');
    try {
      const created = await api<Ticket>('/support/tickets', {
        method: 'POST',
        body: {
          category,
          message: message.trim(),
          bookingId: ABOUT_A_BOOKING.includes(category) ? bookingId : null,
          businessId: category === 'business' ? businessId : null,
        },
      });
      if (photo) {
        const form = new FormData();
        form.set('body', '');
        form.set('photo', photo);
        await api(`/support/tickets/${created.ticket.id}/messages`, { method: 'POST', body: form }).catch(() => {});
      }
      router.push(`/account/help/${created.ticket.id}`);
    } catch (err) {
      setError(errorMessage(err, "Couldn't send that. Please try again."));
      setBusy(false);
    }
  };

  return (
    <form onSubmit={send} className="flex flex-col gap-6">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 font-semibold">What&apos;s it about?</legend>
        <div className="flex flex-wrap gap-2">
          {topics.map((t) => (
            <button key={t} type="button" aria-pressed={category === t} onClick={() => setCategory(t)}
              className={cx('rounded-full px-4 py-2 text-sm font-semibold', category === t ? 'bg-ink text-white' : 'bg-ink/[0.05] hover:bg-accent-soft')}>
              {CATEGORY_LABEL[t]}
            </button>
          ))}
        </div>
      </fieldset>

      {ABOUT_A_BOOKING.includes(category) && (bookings?.length || fromBooking) ? (
        <Select label="Which booking? (optional)" value={bookingId ?? ''} onChange={(e) => setBookingId(e.target.value || null)}>
          <option value="">Not about one booking</option>
          {fromBooking && !bookings?.some((b) => b.bookingId === fromBooking) ? <option value={fromBooking}>The booking you came from</option> : null}
          {(bookings ?? []).map((b) => (
            <option key={b.bookingId} value={b.bookingId}>{b.businessName} · {dayLabel(b.date)} {timeLabel(b.time)}</option>
          ))}
        </Select>
      ) : null}

      {category === 'business' && businesses.length > 1 ? (
        <Select label="Which business?" value={businessId ?? ''} onChange={(e) => setBusinessId(e.target.value || null)}>
          <option value="">Choose…</option>
          {businesses.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </Select>
      ) : null}

      <Textarea label="Tell us what happened" value={message} onChange={(e) => setMessage(e.target.value)} rows={6} maxLength={5000}
        placeholder="e.g. I paid the deposit by M-Pesa but the booking still says unpaid." />

      <label className="w-fit cursor-pointer text-sm font-semibold text-brand hover:underline">
        {photo ? `📎 ${photo.name} (change)` : 'Add a screenshot or photo (optional)'}
        <input type="file" accept="image/jpeg,image/png" className="sr-only" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} />
      </label>

      {error ? <p role="alert" className="font-semibold text-danger">{error}</p> : null}
      <Button type="submit" size="lg" loading={busy} className="w-full sm:w-fit">Send</Button>
    </form>
  );
}
