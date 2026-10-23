'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Button, ButtonLink } from '@/components/ui/button';
import { Avatar, Badge } from '@/components/ui/misc';
import { toast } from '@/components/ui/toast';
import { useWork, workHref } from '@/components/work/context';
import { api, errorMessage } from '@/lib/api';
import { cx, dayLabel, money, relativeTime, timeLabel } from '@/lib/format';
import type { Booking, BookingStatus } from '@/types/booking';
import { AssignModal, balanceOf, CancelModal, RefundModal, RescheduleModal } from './appointment-actions';
import { Loading, LoadError, StatusBadge, SummaryRow } from './bits';
import { formatPhone } from './phone';
import { needsCharge, PAYMENT_METHOD_LABEL } from './status';
import { useBusinessClock } from './hooks';
import { durationLabel, toMinutes, toTime } from './time';
import { useApi, useBookingEvents } from './use-api';
import { useBusiness } from './use-business';
import { AddServiceModal, VisitParts } from './visit';
import type { Visit } from '@/types/work-daily';

const CANCEL_REASON: Record<string, string> = {
  business: 'by the business',
  customer: 'by the customer',
  payment_expired: 'because the deposit wasn’t paid in time',
};

type Dialog = 'assign' | 'reschedule' | 'refund' | 'cancel' | 'add-service' | null;

// One appointment, everything the desk does with it: contact, services and
// money (deposit, payment, tip, fees, refunds), status (check in, done,
// no-show, cancel), assign staff, reschedule and charge. Today shows it as a
// side panel (`onClose`); /appointments/[bookingId] shows it full page.
// Owners and front desk can do all of it.
export function AppointmentPanel({
  bookingId, onClose, onChanged, variant = 'page',
}: {
  bookingId: string;
  onClose?: () => void;
  onChanged?: (booking: Booking) => void;
  variant?: 'page' | 'panel';
}) {
  const { businessId } = useWork();
  const { business } = useBusiness();
  const { data: booking, error, reload, setData } = useApi<Booking>(`/bookings/${bookingId}`);
  // The rest of the visit, when this booking is one part of a multi-staff visit.
  const visitPath = booking?.visitId ? `/visits/${booking.visitId}` : null;
  const { data: visit, reload: reloadVisit, setData: setVisit } = useApi<Visit>(visitPath);
  useBookingEvents(() => {
    reload();
    if (visitPath) reloadVisit();
  });
  const [dialog, setDialog] = useState<Dialog>(null);
  const [updating, setUpdating] = useState<BookingStatus | null>(null);

  // The business's clock, for "has it started yet" (no-show is only allowed after).
  const now = useBusinessClock(business?.timezone);

  const apply = (updated: Booking) => {
    setData(() => updated);
    onChanged?.(updated);
  };

  const setStatus = async (status: BookingStatus, done: string) => {
    if (!booking) return;
    setUpdating(status);
    try {
      apply(await api<Booking>(`/bookings/${booking.bookingId}/status`, { method: 'PATCH', body: { status, reason: null } }));
      toast.success(done);
    } catch (err) {
      toast.error({ title: "Couldn't update this appointment", body: errorMessage(err) });
    } finally {
      setUpdating(null);
    }
  };

  if (!booking) {
    return (
      <Shell variant={variant} onClose={onClose} title="Appointment">
        {error ? <LoadError error={error} onRetry={reload} title="Couldn't load this appointment" /> : <Loading />}
      </Shell>
    );
  }

  if (booking.businessId !== businessId) {
    return (
      <Shell variant={variant} onClose={onClose} title="Appointment">
        <p className="text-ink-2">This appointment belongs to another business.</p>
      </Shell>
    );
  }

  const b = booking;
  const started = b.date < now.date || (b.date === now.date && toMinutes(b.time) <= now.minutes);
  const endTime = toTime(Math.min(toMinutes(b.time) + b.durationMinutes, 24 * 60 - 1));
  const canAssign = ['pending_payment', 'confirmed', 'in_progress'].includes(b.status);
  const canReschedule = (b.status === 'confirmed' || b.status === 'pending_payment') && !started;
  const canCancel = b.status === 'confirmed' || b.status === 'pending_payment';
  const balance = balanceOf(b);
  const canAddService = ['confirmed', 'in_progress', 'completed'].includes(b.status);
  // In a visit, checkout takes the whole visit at once (one payment, tips split between the staff).
  const inVisit = !!(b.visitId && visit);
  const visitDue = inVisit && visit ? visit.balanceDue.amount : 0;
  const onVisit = (v: Visit) => {
    setVisit(() => v);
    const mine = v.bookings.find((x) => x.bookingId === b.bookingId);
    if (mine) apply(mine);
  };

  return (
    <Shell
      variant={variant}
      onClose={onClose}
      title={b.customerName}
      subtitle={
        <span className="flex flex-wrap items-center gap-2">
          <StatusBadge status={b.status} />
          {b.paymentStatus === 'paid' ? <Badge tone="success">Paid{b.paymentMethod ? ` · ${PAYMENT_METHOD_LABEL[b.paymentMethod]}` : ''}</Badge> : null}
          {b.paymentStatus === 'deposit_paid' ? <Badge tone="brand">Deposit paid</Badge> : null}
          {b.refund?.status === 'due' ? <Badge tone="danger">Refund owed</Badge> : null}
          {b.source === 'walk_in' ? <Badge>Added by the desk</Badge> : <Badge>Booked online</Badge>}
          {b.reference ? <span className="font-mono text-xs text-ink-3">{b.reference}</span> : null}
        </span>
      }
      fullHref={variant === 'panel' ? workHref(businessId, `appointments/${b.bookingId}`) : undefined}
    >
      {/* Actions first: what the desk came here to do. */}
      <div className="flex flex-wrap gap-2">
        {b.status === 'confirmed' ? (
          <Button size="sm" loading={updating === 'in_progress'} disabled={!!updating} onClick={() => setStatus('in_progress', `${b.customerName} checked in`)}>
            Check in
          </Button>
        ) : null}
        {inVisit && visitDue > 0 ? (
          <ButtonLink size="sm" variant="brand" href={workHref(businessId, `checkout/visit/${b.visitId}`)}>Check out visit {money(visitDue)}</ButtonLink>
        ) : !inVisit && needsCharge(b) ? (
          <ButtonLink size="sm" variant="brand" href={workHref(businessId, `checkout/${b.bookingId}`)}>Charge {money(balance)}</ButtonLink>
        ) : null}
        {canAddService ? (
          <Button size="sm" variant="secondary" onClick={() => setDialog('add-service')}>
            Add service
          </Button>
        ) : null}
        {b.status === 'in_progress' ? (
          <Button size="sm" variant="secondary" loading={updating === 'completed'} disabled={!!updating} onClick={() => setStatus('completed', 'Marked done. Charge them when they pay.')}>
            Mark done
          </Button>
        ) : null}
        {canReschedule ? (
          <Button size="sm" variant="secondary" onClick={() => setDialog('reschedule')}>
            Reschedule
          </Button>
        ) : null}
        {b.status === 'confirmed' ? (
          <Button
            size="sm"
            variant="secondary"
            loading={updating === 'no_show'}
            disabled={!!updating || !started}
            title={started ? undefined : 'Available once the start time has passed'}
            onClick={() => setStatus('no_show', 'Marked as a no-show')}
          >
            No-show
          </Button>
        ) : null}
        {canCancel ? (
          <Button size="sm" variant="danger" disabled={!!updating} onClick={() => setDialog('cancel')}>
            Cancel
          </Button>
        ) : null}
      </div>
      {b.status === 'confirmed' && !started ? <p className="-mt-3 text-xs text-ink-3">No-show is available once the start time has passed.</p> : null}

      <Section title="When">
        <p className="font-semibold">{dayLabel(b.date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
        <p className="text-ink-2">
          {timeLabel(b.time)} – {timeLabel(endTime)} · {durationLabel(b.durationMinutes)}
        </p>
        {b.status === 'pending_payment' && b.expiresAt ? (
          <p className="mt-1 text-sm text-warning">Held until the deposit is paid; the hold lapses {new Date(b.expiresAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}.</p>
        ) : null}
        {b.status === 'cancelled' && b.cancelReason ? <p className="mt-1 text-sm text-ink-2">Cancelled {CANCEL_REASON[b.cancelReason] ?? `: ${b.cancelReason}`}</p> : null}
      </Section>

      <Section
        title="Staff"
        action={
          canAssign ? (
            <Button size="sm" variant="secondary" onClick={() => setDialog('assign')}>
              {b.staffId ? 'Reassign' : 'Assign'}
            </Button>
          ) : null
        }
      >
        <div className="flex items-center gap-3">
          {b.staffId ? <Avatar name={b.staffName} src={b.staffAvatarUrl} size={36} /> : null}
          <p className={cx('font-semibold', !b.staffId && 'text-warning')}>{b.staffId ? b.staffName : 'Unassigned (any available)'}</p>
        </div>
      </Section>

      {inVisit && visit ? (
        <Section title="This visit">
          <VisitParts visit={visit} currentBookingId={b.bookingId} />
        </Section>
      ) : null}

      <Section title="Customer">
        <div className="flex items-center gap-3">
          <Avatar name={b.customerName} src={b.customerAvatarUrl} size={36} />
          <p className="font-semibold">{b.customerName}</p>
        </div>
        {b.customerPhone ? (
          <a href={`tel:${b.customerPhone}`} className="block text-ink-2 hover:text-ink hover:underline">
            {formatPhone(b.customerPhone)}
          </a>
        ) : null}
        {b.customerEmail ? (
          <a href={`mailto:${b.customerEmail}`} className="block truncate text-ink-2 hover:text-ink hover:underline">
            {b.customerEmail}
          </a>
        ) : null}
        {!b.customerPhone && !b.customerEmail ? <p className="text-sm text-ink-3">No contact details</p> : null}
        {b.customerHasAccount ? (
          <p className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-brand">
            <span className="size-2 rounded-full bg-brand" aria-hidden />
            On Trimmy: they see this booking in their app
          </p>
        ) : null}
      </Section>

      <Section title="Services">
        <div className="divide-y divide-line">
          {b.services.map((s) => (
            <div key={s.serviceId} className="flex items-baseline justify-between gap-4 py-1.5">
              <span>
                {s.quantity > 1 ? `${s.quantity}× ` : ''}
                {s.name} <span className="text-sm text-ink-3">· {durationLabel(s.durationMinutes * s.quantity)}</span>
              </span>
              <span className="tabular-nums">{money({ ...s.price, amount: s.price.amount * s.quantity })}</span>
            </div>
          ))}
        </div>
        <SummaryRow strong label="Total" value={money(b.totalAmount)} />
      </Section>

      <Section title="Payments">
        {b.depositAmount && !b.depositPaid ? <SummaryRow muted label="Deposit required" value={money(b.depositAmount)} /> : null}
        {b.depositPaid ? (
          <>
            <SummaryRow label="Deposit paid · M-Pesa" value={money(b.depositPaid)} />
            {b.depositPayment?.receipt || b.depositPayment?.destination ? (
              <p className="pb-1 text-sm text-ink-2">
                {b.depositPayment?.receipt ? <>Receipt <span className="font-mono">{b.depositPayment.receipt}</span></> : null}
                {b.depositPayment?.receipt && b.depositPayment?.destination ? ' · ' : ''}
                {b.depositPayment?.destination ? `to ${b.depositPayment.destination.label}` : ''}
                {b.depositPayment?.paidAt ? ` · ${relativeTime(b.depositPayment.paidAt)}` : ''}
              </p>
            ) : null}
          </>
        ) : null}
        {b.paymentStatus === 'paid' ? (
          <>
            <SummaryRow
              label={`Paid at checkout${b.paymentMethod ? ` · ${PAYMENT_METHOD_LABEL[b.paymentMethod]}` : ''}`}
              value={money(b.totalAmount.amount - (b.depositPaid?.amount ?? 0))}
            />
            {b.paymentReference ? (
              <p className="pb-1 text-sm text-ink-2">
                Receipt <span className="font-mono">{b.paymentReference}</span>
              </p>
            ) : null}
          </>
        ) : b.status !== 'cancelled' && b.status !== 'no_show' ? (
          <SummaryRow strong label="Balance due" value={money(balance)} />
        ) : null}
        {b.tip ? <SummaryRow label={`Tip for ${b.staffName}`} value={money(b.tip)} /> : null}
        {b.tip ? <p className="pb-1 text-sm text-ink-2">In their wallet; not counted as revenue.</p> : null}
        {b.chargePayment && b.paymentStatus !== 'paid' && b.chargePayment.status === 'pending' ? (
          <p className="text-sm text-warning">An M-Pesa prompt is waiting on the customer&apos;s phone.</p>
        ) : null}
        {b.noShowFee ? (
          <>
            <SummaryRow label={`No-show fee (${b.noShowFee.percent}%)`} value={money(b.noShowFee.fee)} />
            <SummaryRow muted label="Kept from the deposit" value={money(b.noShowFee.kept)} />
            {b.noShowFee.uncollected.amount > 0 ? <SummaryRow muted label="Not collected" value={money(b.noShowFee.uncollected)} /> : null}
          </>
        ) : null}
        {b.cancellationFee && b.cancellationFee.amount > 0 ? <SummaryRow label="Late cancellation fee (kept)" value={money(b.cancellationFee)} /> : null}
        {b.refund ? (
          <div className={cx('mt-2 rounded-xl px-4 py-3', b.refund.status === 'due' ? 'bg-danger/5' : 'bg-surface-2')}>
            {b.refund.status === 'due' ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-danger">Refund owed: {money(b.refund.amount)}</p>
                  <p className="text-sm text-ink-2">Send it back to {b.customerName}, then mark it paid.</p>
                </div>
                <Button size="sm" variant="secondary" onClick={() => setDialog('refund')}>
                  Mark refund paid
                </Button>
              </div>
            ) : (
              <p className="text-sm">
                Refunded <span className="font-semibold">{money(b.refund.amount)}</span>
                {b.refund.reference ? <> · <span className="font-mono">{b.refund.reference}</span></> : null}
                {b.refund.refundedAt ? ` · ${relativeTime(b.refund.refundedAt)}` : ''}
              </p>
            )}
          </div>
        ) : null}
      </Section>

      {b.notes ? (
        <Section title="Notes">
          <p className="whitespace-pre-line text-ink-2">{b.notes}</p>
        </Section>
      ) : null}

      {b.review ? (
        <Section title="Review">
          <p className="font-semibold" aria-label={`${b.review.rating} out of 5`}>
            {'★'.repeat(b.review.rating)}
            <span className="text-line-2">{'★'.repeat(5 - b.review.rating)}</span>
          </p>
          {b.review.text ? <p className="text-ink-2">“{b.review.text}”</p> : null}
        </Section>
      ) : null}

      {dialog === 'add-service' ? (
        <AddServiceModal booking={b} business={business} open onClose={() => setDialog(null)} onDone={onVisit} />
      ) : null}
      <AssignModal booking={b} business={business} open={dialog === 'assign'} onClose={() => setDialog(null)} onDone={apply} />
      {dialog === 'reschedule' ? <RescheduleModal booking={b} today={now.date} open onClose={() => setDialog(null)} onDone={apply} /> : null}
      {dialog === 'refund' ? <RefundModal booking={b} open onClose={() => setDialog(null)} onDone={apply} /> : null}
      {dialog === 'cancel' ? <CancelModal booking={b} open onClose={() => setDialog(null)} onDone={apply} /> : null}
    </Shell>
  );
}

function Shell({
  variant, title, subtitle, onClose, fullHref, children,
}: {
  variant: 'page' | 'panel';
  title: string;
  subtitle?: React.ReactNode;
  onClose?: () => void;
  fullHref?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cx('flex flex-col', variant === 'panel' ? 'h-full' : '')}>
      <div className={cx('flex items-start justify-between gap-3', variant === 'panel' ? 'border-b border-line px-5 py-4' : 'mb-6')}>
        <div className="min-w-0">
          {variant === 'panel' ? (
            <h2 className="truncate text-xl font-extrabold tracking-tight">{title}</h2>
          ) : (
            <h1 className="truncate text-2xl font-extrabold tracking-tight sm:text-3xl">{title}</h1>
          )}
          {subtitle ? <div className="mt-2">{subtitle}</div> : null}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {fullHref ? (
            <Link href={fullHref} className="rounded-full px-3 py-2 text-sm font-semibold text-ink-2 hover:bg-surface-2 hover:text-ink">
              Open
            </Link>
          ) : null}
          {onClose ? (
            <button type="button" onClick={onClose} aria-label="Close appointment" className="grid size-9 place-items-center rounded-full hover:bg-surface-2">
              ✕
            </button>
          ) : null}
        </div>
      </div>
      <div className={cx('flex flex-col gap-5', variant === 'panel' ? 'flex-1 overflow-y-auto px-5 py-5' : 'max-w-3xl')}>{children}</div>
    </div>
  );
}

function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-card border border-line bg-white p-4" aria-label={title}>
      <div className="mb-2 flex items-center justify-between gap-3">
        <h3 className="text-xs font-semibold tracking-wide text-ink-3 uppercase">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}
