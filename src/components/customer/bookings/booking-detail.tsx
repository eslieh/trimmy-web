'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ApiError, api, errorMessage } from '@/lib/api';
import { Button, ButtonLink, Spinner, buttonClass } from '@/components/ui/button';
import { Textarea } from '@/components/ui/field';
import { Avatar, Badge } from '@/components/ui/misc';
import { Modal } from '@/components/ui/modal';
import { toast } from '@/components/ui/toast';
import { cx, dayLabel, timeLabel } from '@/lib/format';
import type { Booking, BookingReview } from '@/types/booking';
import type { BusinessProfile } from '@/types/discovery';
import type { CancelPreview } from '@/types/customer-web';
import { BookingMoney } from '../booking/booking-money';
import { SlotPicker, isComplete, type SlotChoice } from '../booking/slot-picker';
import { useLoad, useNow } from '../hooks';
import { ChevronLeftIcon, ClockIcon, PinIcon, StarIcon, Stars } from '../icons';
import { STATUS_LABEL, STATUS_TONE, mapsUrl, minutesLabel } from '../labels';
import { Photo } from '../photo';

const CANCEL_REASONS = ['Something came up', 'Found another time', 'Booked by mistake', 'Other'];

function startsAtMs(b: Booking): number {
  // startsAt carries the business's UTC offset; the fallback assumes Nairobi (+03:00).
  return new Date(b.startsAt ?? `${b.date}T${b.time}:00+03:00`).getTime();
}

function statusNote(b: Booking): string | null {
  if (b.status === 'pending_payment') return 'Pay the deposit to confirm this booking. The slot is only held for a short time.';
  if (b.status === 'cancelled') {
    if (b.cancelReason === 'payment_expired') {
      return b.paymentStatus === 'deposit_paid'
        ? 'Your payment arrived after the hold expired. The business will refund you.'
        : "The deposit wasn't paid in time, so the slot was released.";
    }
    if (b.cancelReason === 'customer') return 'You cancelled this appointment.';
    return `${b.businessName} cancelled this appointment.`;
  }
  if (b.status === 'no_show') return 'Marked as a no-show by the business.';
  return null;
}

// One booking (mobile BookingDetailScreen): details and money, location,
// and what the customer can do now: pay a pending deposit, reschedule or
// cancel within policy, or review a completed visit.
export function BookingDetail({ initial, profile }: { initial: Booking; profile: BusinessProfile | null }) {
  const [booking, setBooking] = useState(initial);
  const now = useNow();
  const [modal, setModal] = useState<'cancel' | 'reschedule' | 'review' | null>(null);

  // Before hydration (now = 0) assume it's still ahead, as the server does.
  const ahead = now === 0 || startsAtMs(booking) > now;
  const active = booking.status === 'confirmed' || booking.status === 'pending_payment';
  const canCancel = active && ahead;

  // Rescheduling is only allowed while cancelling would still be free:
  // cancel-preview's freeUntil is that cutoff (BK-61).
  const preview = useLoad(canCancel ? `cancel-preview:${booking.bookingId}:${booking.status}:${booking.date}:${booking.time}` : null, () =>
    api<CancelPreview>(`/bookings/${booking.bookingId}/cancel-preview`),
  );
  const freeUntil = (preview.data ?? preview.stale)?.freeUntil;
  const reschedulable = canCancel && booking.services.every((s) => !!s.serviceId) && !!freeUntil && (now === 0 || new Date(freeUntil).getTime() > now);

  const staff = booking.staffId ? profile?.staff.find((s) => s.staffId === booking.staffId) : null;
  const note = statusNote(booking);

  return (
    <div className="mx-auto max-w-5xl">
      <Link href="/bookings" className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-ink-2 hover:text-ink">
        <ChevronLeftIcon className="size-4" /> My bookings
      </Link>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-6">
          <header className="flex items-start gap-4">
            <div className="relative size-20 shrink-0 overflow-hidden rounded-card bg-surface-3 sm:size-24">
              <Photo src={profile?.photos[0]} alt="" name={booking.businessName} sizes="96px" />
            </div>
            <div className="min-w-0">
              <Badge tone={STATUS_TONE[booking.status]}>{STATUS_LABEL[booking.status]}</Badge>
              <h1 className="mt-1.5 text-2xl font-extrabold tracking-tight sm:text-3xl">
                {profile ? <Link href={`/b/${booking.businessId}`} className="hover:underline">{booking.businessName}</Link> : booking.businessName}
              </h1>
              {booking.reference ? (
                <p className="text-sm text-ink-2">
                  Ref <span className="font-mono font-semibold text-ink">{booking.reference}</span>
                </p>
              ) : null}
            </div>
          </header>

          {note ? <p className={cx('rounded-xl px-4 py-3 text-[15px]', booking.status === 'pending_payment' ? 'bg-warning/10 text-warning' : 'bg-surface-2 text-ink-2')}>{note}</p> : null}

          <section className="rounded-card border border-line p-5">
            <div className="flex items-start gap-3">
              <ClockIcon className="mt-1 size-5 shrink-0 text-ink-2" />
              <div>
                <p className="text-lg font-bold">{dayLabel(booking.date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
                <p className="text-ink-2">
                  {timeLabel(booking.time)} · {minutesLabel(booking.durationMinutes)}
                </p>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-3 border-t border-line pt-4">
              {staff ? <Avatar name={staff.name} src={staff.avatarUrl} size={40} /> : <span className="grid size-10 place-items-center rounded-full bg-surface-3 font-bold text-ink-2" aria-hidden>?</span>}
              <div>
                <p className="font-semibold">{booking.staffName}</p>
                <p className="text-sm text-ink-2">{staff ? staff.specialties.slice(0, 2).join(', ') || 'Your professional' : booking.staffId ? 'Your professional' : 'The business will assign someone'}</p>
              </div>
            </div>
          </section>

          <section className="rounded-card border border-line p-5" aria-labelledby="payment-h">
            <h2 id="payment-h" className="mb-3 font-bold">Services & payment</h2>
            <BookingMoney booking={booking} />
          </section>

          {booking.notes ? (
            <section className="rounded-card border border-line p-5">
              <h2 className="mb-1 font-bold">Your notes</h2>
              <p className="whitespace-pre-line text-ink-2">{booking.notes}</p>
            </section>
          ) : null}

          {booking.status === 'completed' ? (
            <section className="rounded-card border border-line p-5" aria-labelledby="review-h">
              <h2 id="review-h" className="mb-2 font-bold">Your review</h2>
              {booking.review ? (
                <>
                  <Stars rating={booking.review.rating} />
                  {booking.review.text ? <p className="mt-2">{booking.review.text}</p> : null}
                  {booking.review.replyText ? (
                    <div className="mt-3 rounded-2xl bg-ink/[0.03] p-4">
                      <p className="text-xs font-semibold tracking-wide text-ink-2 uppercase">Reply from {booking.businessName}</p>
                      <p className="mt-1">{booking.review.replyText}</p>
                    </div>
                  ) : null}
                </>
              ) : (
                <>
                  <p className="text-ink-2">How was your visit? Your review helps others choose.</p>
                  <Button className="mt-3" onClick={() => setModal('review')}>
                    Leave a review
                  </Button>
                </>
              )}
            </section>
          ) : null}
        </div>

        <aside className="flex flex-col gap-4 lg:sticky lg:top-24 lg:self-start">
          {booking.status === 'pending_payment' && ahead ? (
            <ButtonLink href={`/b/${booking.businessId}/book?booking=${booking.bookingId}`} variant="brand" size="lg" className="w-full">
              Pay deposit
            </ButtonLink>
          ) : null}
          {canCancel ? (
            <div className="flex flex-col gap-2 rounded-card border border-line p-5">
              <h2 className="font-bold">Need to change plans?</h2>
              {reschedulable ? (
                <Button onClick={() => setModal('reschedule')}>Reschedule</Button>
              ) : preview.loading && !preview.stale ? null : (
                <p className="text-sm text-ink-2">It&apos;s too late to change the time online. Contact {booking.businessName} if you need to move it.</p>
              )}
              <Button variant="danger" onClick={() => setModal('cancel')}>
                Cancel appointment
              </Button>
              {freeUntil && reschedulable ? (
                <p className="text-[13px] text-ink-2">
                  Free to change or cancel until{' '}
                  {new Date(freeUntil).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Africa/Nairobi' })}.
                </p>
              ) : null}
            </div>
          ) : null}
          {booking.status === 'cancelled' || booking.status === 'completed' || booking.status === 'no_show' ? (
            <ButtonLink href={`/b/${booking.businessId}`} variant="secondary" className="w-full">
              Book again
            </ButtonLink>
          ) : null}

          {profile ? (
            <div className="rounded-card border border-line p-5">
              <h2 className="mb-1 font-bold">Location</h2>
              <p className="text-ink-2">{profile.address}</p>
              <a href={mapsUrl(profile.lat, profile.lng, profile.address)} target="_blank" rel="noopener noreferrer" className={cx(buttonClass('secondary', 'sm'), 'mt-3')}>
                <PinIcon /> Directions
              </a>
            </div>
          ) : null}

          {profile ? (
            <div className="rounded-card bg-surface-2 p-5 text-sm text-ink-2">
              <h2 className="mb-1 font-bold text-ink">Policies</h2>
              <p>{profile.cancellationSummary}</p>
              {profile.policies.noShow.feePercent > 0 ? <p className="mt-1">No-show fee: {profile.policies.noShow.feePercent}% of the total.</p> : null}
            </div>
          ) : null}
        </aside>
      </div>

      {modal === 'cancel' ? (
        <CancelModal booking={booking} businessName={booking.businessName} onClose={() => setModal(null)} onCancelled={(b) => setBooking(b)} />
      ) : null}
      {modal === 'reschedule' ? (
        <RescheduleModal
          booking={booking}
          onClose={() => setModal(null)}
          onMoved={(b) => {
            setBooking(b);
            preview.reload();
          }}
        />
      ) : null}
      {modal === 'review' ? (
        <ReviewModal bookingId={booking.bookingId} onClose={() => setModal(null)} onPosted={(review) => setBooking((b) => ({ ...b, review }))} />
      ) : null}
    </div>
  );
}

function CancelModal({ booking, businessName, onClose, onCancelled }: { booking: Booking; businessName: string; onClose: () => void; onCancelled: (b: Booking) => void }) {
  // A fresh preview each time it opens: the fee depends on how close it is.
  const preview = useLoad(`cancel:${booking.bookingId}`, () => api<CancelPreview>(`/bookings/${booking.bookingId}/cancel-preview`), "Couldn't check the cancellation terms.");
  const [reason, setReason] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const p = preview.data;

  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      const cancelled = await api<Booking>(`/bookings/${booking.bookingId}/cancel`, { method: 'POST', body: { reason } });
      onCancelled(cancelled);
      toast.success('Appointment cancelled');
      onClose();
    } catch (err) {
      setError(errorMessage(err, "Couldn't cancel this appointment."));
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      locked={busy}
      title="Cancel this appointment?"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Keep appointment
          </Button>
          <Button variant="danger" onClick={confirm} loading={busy} disabled={!p?.canCancel}>
            Cancel appointment
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4 pb-2">
        <p className="text-ink-2">
          {dayLabel(booking.date, { weekday: 'long', day: 'numeric', month: 'long' })} at {timeLabel(booking.time)} with {businessName}.
        </p>
        {preview.error ? (
          <p role="alert" className="text-danger">{preview.error}</p>
        ) : !p ? (
          <div className="grid h-16 place-items-center text-ink-2">
            <Spinner />
          </div>
        ) : !p.canCancel ? (
          <p className="rounded-xl bg-danger/10 px-4 py-3 text-danger">{p.reasonBlocked ?? "This appointment can't be cancelled online."}</p>
        ) : (
          <>
            {/* The server's message already explains any fee and refund in words. */}
            <p className={cx('rounded-xl px-4 py-3', p.fee.amount > 0 ? 'bg-warning/10 text-warning' : 'bg-success/10 text-success')}>{p.message}</p>
            <fieldset>
              <legend className="mb-2 text-sm font-semibold">Reason (optional)</legend>
              <div className="flex flex-wrap gap-2">
                {CANCEL_REASONS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    aria-pressed={reason === r}
                    onClick={() => setReason(reason === r ? null : r)}
                    className={cx('rounded-full border px-4 py-2 text-sm font-semibold', reason === r ? 'border-ink bg-ink text-white' : 'border-line-2 hover:border-ink')}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </fieldset>
          </>
        )}
        {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
      </div>
    </Modal>
  );
}

function RescheduleModal({ booking, onClose, onMoved }: { booking: Booking; onClose: () => void; onMoved: (b: Booking) => void }) {
  const [choice, setChoice] = useState<SlotChoice | null>(null);
  const [version, setVersion] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const serviceIds = booking.services.map((s) => s.serviceId);

  const save = async () => {
    if (!isComplete(choice)) return;
    setBusy(true);
    setError(null);
    try {
      // staffId left out: the same professional (or "any available") keeps it.
      const moved = await api<Booking>(`/bookings/${booking.bookingId}/reschedule`, { method: 'POST', body: { date: choice.date, time: choice.time } });
      onMoved(moved);
      toast.success({ title: 'Appointment moved', body: `${dayLabel(moved.date)} at ${timeLabel(moved.time)}` });
      onClose();
    } catch (err) {
      if (err instanceof ApiError && err.code === 'slot_unavailable') {
        setChoice({ date: choice.date, time: null });
        setVersion((v) => v + 1);
      }
      setError(errorMessage(err, "Couldn't move your appointment."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      wide
      onClose={onClose}
      locked={busy}
      title="Pick a new time"
      footer={
        <div className="flex flex-col gap-3">
          {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={onClose} disabled={busy}>
              Keep current time
            </Button>
            <Button onClick={save} loading={busy} disabled={!isComplete(choice)}>
              {isComplete(choice) ? `Move to ${dayLabel(choice.date)}, ${timeLabel(choice.time)}` : 'Move appointment'}
            </Button>
          </div>
        </div>
      }
    >
      <p className="mb-4 text-ink-2">
        Currently {dayLabel(booking.date, { weekday: 'long', day: 'numeric', month: 'long' })} at {timeLabel(booking.time)} with {booking.staffName}. Your services, price and any deposit stay the same.
      </p>
      <SlotPicker businessId={booking.businessId} serviceIds={serviceIds} staffId={booking.staffId} value={choice} onChange={setChoice} version={version} />
    </Modal>
  );
}

function ReviewModal({ bookingId, onClose, onPosted }: { bookingId: string; onClose: () => void; onPosted: (r: BookingReview) => void }) {
  const [rating, setRating] = useState(0);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const post = async () => {
    setBusy(true);
    setError(null);
    try {
      const review = await api<BookingReview>(`/bookings/${bookingId}/review`, { method: 'POST', body: { rating, text: text.trim() || null } });
      onPosted(review);
      toast.success('Thanks for your review!');
      onClose();
    } catch (err) {
      setError(errorMessage(err, "Couldn't post your review."));
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      locked={busy}
      title="How was your visit?"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Not now
          </Button>
          <Button onClick={post} loading={busy} disabled={rating === 0}>
            Post review
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4 pb-2">
        <div role="radiogroup" aria-label="Rating" className="flex gap-1">
          {[1, 2, 3, 4, 5].map((v) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={rating === v}
              aria-label={`${v} star${v > 1 ? 's' : ''}`}
              onClick={() => setRating(v)}
              className={cx('rounded-lg p-1 transition-colors', v <= rating ? 'text-brand-pink' : 'text-line-2 hover:text-ink-3')}
            >
              <StarIcon className="size-9" />
            </button>
          ))}
        </div>
        <Textarea label="Tell others about it (optional)" placeholder="e.g. Great fade, on time" maxLength={1000} value={text} onChange={(e) => setText(e.target.value)} />
        {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
      </div>
    </Modal>
  );
}
