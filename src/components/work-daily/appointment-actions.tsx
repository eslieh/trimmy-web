'use client';

import { useEffect, useRef, useState } from 'react';
import { Button, Spinner } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { toast } from '@/components/ui/toast';
import { api, ApiError, errorMessage } from '@/lib/api';
import { cx, money } from '@/lib/format';
import type { Booking, PaymentMethod } from '@/types/booking';
import type { ChargeStarted, WorkBusiness } from '@/types/work-daily';
import { InlineError, Segmented, SummaryRow } from './bits';
import { formatPhone, normalizePhone, PHONE_HINT } from './phone';
import { failureMessage } from './status';
import { staffForServices } from './use-business';

// The Appointment panel's dialogs: charge (with tip), assign staff,
// reschedule, mark refund paid, cancel. Each calls back with the updated Booking.

type Done = (booking: Booking) => void;

const TIP_PRESETS = [0, 50, 100, 200];
const POLL_MS = 3000;
const POLL_LIMIT_MS = 2 * 60 * 1000;

export function balanceOf(b: Booking): number {
  return (b.balanceDue ?? { amount: b.totalAmount.amount - (b.depositPaid?.amount ?? 0) }).amount;
}

// Charge customer: M-Pesa prompt or cash, plus an optional tip for the
// assigned staff member in the same payment (charge-booking). M-Pesa
// answers 202 and we poll the booking every 3s, like mobile's waitForCharge.
export function ChargeModal({ booking, open, onClose, onDone }: { booking: Booking; open: boolean; onClose: () => void; onDone: Done }) {
  const [method, setMethod] = useState<PaymentMethod>('mpesa');
  const [phone, setPhone] = useState(formatPhone(booking.customerPhone));
  const [tip, setTip] = useState(0);
  const [customTip, setCustomTip] = useState('');
  const [step, setStep] = useState<'form' | 'pending' | 'success'>('form');
  const [error, setError] = useState('');
  const [charged, setCharged] = useState<{ amount: number; method: PaymentMethod } | null>(null);
  const polling = useRef(0); // bumped to stop an in-flight poll
  useEffect(() => () => void (polling.current += 1), []);

  const balance = balanceOf(booking);
  const tipAmount = customTip ? Number(customTip) : tip;
  const total = balance + (booking.staffId ? tipAmount : 0);

  const reset = () => {
    polling.current += 1;
    setStep('form');
    setError('');
    setTip(0);
    setCustomTip('');
    setCharged(null);
  };
  const close = () => {
    reset();
    onClose();
  };

  const succeed = (b: Booking) => {
    setStep('success');
    onDone(b);
  };

  const waitForCharge = async () => {
    const run = ++polling.current;
    const started = Date.now();
    while (Date.now() - started < POLL_LIMIT_MS) {
      await new Promise((r) => setTimeout(r, POLL_MS));
      if (run !== polling.current) return;
      const b = await api<Booking>(`/bookings/${booking.bookingId}`).catch(() => null); // a dropped poll isn't an outcome
      if (run !== polling.current) return;
      if (!b) continue;
      if (b.paymentStatus === 'paid') return succeed(b);
      const attempt = b.chargePayment;
      if (attempt && (attempt.status === 'failed' || attempt.status === 'timeout')) {
        onDone(b);
        setError(`${failureMessage(attempt.failureReason)} Try again or take cash.`);
        return setStep('form');
      }
    }
    setError(`${failureMessage('timeout')} Try again or take cash.`);
    setStep('form');
  };

  const submit = async () => {
    setError('');
    const tipValue = booking.staffId && tipAmount > 0 ? tipAmount : 0;
    if (customTip && !(Number(customTip) >= 0 && Number(customTip) <= 100000)) return setError('Enter a tip between 0 and 100,000.');
    let normalized: string | null = null;
    if (method === 'mpesa') {
      normalized = normalizePhone(phone);
      if (!normalized) return setError(`Enter the customer's M-Pesa number (${PHONE_HINT}).`);
    }
    setCharged({ amount: balance + tipValue, method });
    setStep('pending');
    try {
      const res = await api<Booking | ChargeStarted>(`/bookings/${booking.bookingId}/charge`, {
        method: 'POST',
        body: { method, ...(normalized ? { phone: normalized } : {}), ...(tipValue ? { tip: tipValue } : {}) },
      });
      // Cash, or nothing left to pay: the paid Booking comes straight back.
      if ('totalAmount' in res) return succeed(res);
      await waitForCharge();
    } catch (err) {
      if (err instanceof ApiError && err.code === 'payment_in_progress') return waitForCharge();
      setError(
        err instanceof ApiError && err.code === 'tip_needs_staff'
          ? 'Assign someone to this appointment to give them a tip.'
          : errorMessage(err, "Couldn't charge the customer."),
      );
      setStep('form');
    }
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title={step === 'form' ? 'Charge customer' : undefined}
      locked={step === 'pending'}
      footer={
        step === 'form' ? (
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={close}>
              Cancel
            </Button>
            <Button onClick={submit}>{method === 'mpesa' ? `Send M-Pesa prompt · ${money(total)}` : `Record cash · ${money(total)}`}</Button>
          </div>
        ) : null
      }
    >
      {step === 'pending' ? (
        <div className="flex flex-col items-center gap-3 py-10 text-center" aria-live="polite">
          <Spinner className="size-8 text-brand" />
          {charged?.method === 'mpesa' ? (
            <>
              <p className="text-lg font-bold">Check their phone</p>
              <p className="max-w-xs text-ink-2">
                We sent an M-Pesa prompt for {money(charged.amount)} to {phone}. Waiting for them to enter their PIN.
              </p>
              <Button variant="ghost" size="sm" onClick={() => { polling.current += 1; close(); }}>
                Stop waiting
              </Button>
            </>
          ) : (
            <p className="text-lg font-bold">Recording payment…</p>
          )}
        </div>
      ) : step === 'success' ? (
        <div className="flex flex-col items-center gap-3 py-10 text-center" aria-live="polite">
          <span className="grid size-14 place-items-center rounded-full bg-success/10 text-2xl text-success" aria-hidden>
            ✓
          </span>
          <p className="text-lg font-bold">{charged?.method === 'cash' ? 'Cash recorded' : 'Payment received'}</p>
          <p className="text-ink-2">{charged ? money(charged.amount) : ''} from {booking.customerName}</p>
          <Button onClick={close} className="mt-2">
            Done
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-5 pb-2">
          <div className="rounded-xl bg-surface-2 px-4 py-3">
            <SummaryRow label="Balance" value={money(balance)} />
            {booking.depositPaid ? <SummaryRow muted label="Deposit already paid" value={money(booking.depositPaid)} /> : null}
            {booking.staffId && tipAmount > 0 ? <SummaryRow muted label={`Tip for ${booking.staffName}`} value={money(tipAmount)} /> : null}
            <SummaryRow strong label="To pay now" value={money(total)} />
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-sm font-semibold">Payment method</p>
            <Segmented label="Payment method" value={method} onChange={setMethod} options={[{ key: 'mpesa', label: 'M-Pesa' }, { key: 'cash', label: 'Cash' }]} />
          </div>

          {method === 'mpesa' ? (
            <Input label="Customer's M-Pesa number" type="tel" inputMode="tel" placeholder="0712 345 678" value={phone} onChange={(e) => setPhone(e.target.value)} hint="They get a prompt to enter their PIN." />
          ) : null}

          {booking.staffId ? (
            <div className="flex flex-col gap-2">
              <p className="text-sm font-semibold">Tip for {booking.staffName} (optional)</p>
              <Segmented
                label="Tip"
                value={customTip ? null : tip}
                onChange={(v) => {
                  setCustomTip('');
                  setTip(v);
                }}
                options={TIP_PRESETS.map((a) => ({ key: a, label: a === 0 ? 'None' : `${a}` }))}
              />
              <Input
                label="Other amount (KSh)"
                inputMode="numeric"
                value={customTip}
                onChange={(e) => setCustomTip(e.target.value.replace(/\D/g, '').slice(0, 6))}
                hint="Paid with the balance in one go; it goes to their wallet."
              />
            </div>
          ) : (
            <p className="text-sm text-ink-2">Assign someone to this appointment to add a tip for them.</p>
          )}
          <InlineError>{error}</InlineError>
        </div>
      )}
    </Modal>
  );
}

// Give an unassigned booking to someone, or move it (assign-booking-staff).
// 409 staff_unavailable keeps the list open to pick someone else.
export function AssignModal({ booking, business, open, onClose, onDone }: { booking: Booking; business: WorkBusiness | null; open: boolean; onClose: () => void; onDone: Done }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const able = business ? staffForServices(business, booking.services.map((s) => s.serviceId)) : [];
  const others = business ? business.staff.filter((m) => m.bookable && !able.includes(m)) : [];

  const assign = async (staffId: string, name: string) => {
    setBusy(staffId);
    setError('');
    try {
      const updated = await api<Booking>(`/bookings/${booking.bookingId}/staff`, { method: 'PATCH', body: { staffId } });
      toast.success(`Assigned to ${updated.staffName || name}`);
      onDone(updated);
      onClose();
    } catch (err) {
      setError(
        err instanceof ApiError && err.code === 'staff_unavailable'
          ? `${name} can't take this booking: busy, off that day, or doesn't offer the service. Choose someone else.`
          : errorMessage(err, "Couldn't assign this booking."),
      );
    } finally {
      setBusy(null);
    }
  };

  const row = (m: { staffId: string; name: string }, dim: boolean) => {
    const current = m.staffId === booking.staffId;
    return (
      <li key={m.staffId}>
        <button
          type="button"
          disabled={current || !!busy}
          onClick={() => assign(m.staffId, m.name)}
          className={cx('flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-surface-2 disabled:hover:bg-transparent', dim && 'text-ink-2')}
        >
          <span className="font-semibold">
            {m.name}
            {current ? <span className="ml-2 text-sm font-normal text-ink-3">assigned</span> : null}
          </span>
          {busy === m.staffId ? <Spinner className="size-4" /> : null}
        </button>
      </li>
    );
  };

  return (
    <Modal open={open} onClose={onClose} title={booking.staffId ? 'Reassign' : 'Assign staff'} locked={!!busy}>
      <div className="flex flex-col gap-3 pb-3">
        <InlineError>{error}</InlineError>
        {!business ? (
          <p className="text-ink-2">Loading the team…</p>
        ) : able.length + others.length === 0 ? (
          <p className="text-ink-2">No one can take bookings yet. The owner adds staff and their services in Team.</p>
        ) : (
          <>
            <ul className="divide-y divide-line rounded-xl border border-line">{able.map((m) => row(m, false))}</ul>
            {others.length ? (
              <>
                <p className="text-sm text-ink-2">Don&apos;t offer every service on this booking:</p>
                <ul className="divide-y divide-line rounded-xl border border-line">{others.map((m) => row(m, true))}</ul>
              </>
            ) : null}
          </>
        )}
      </div>
    </Modal>
  );
}

// Owner / front desk: any future time within working hours (reschedule-booking).
export function RescheduleModal({ booking, today, open, onClose, onDone }: { booking: Booking; today: string; open: boolean; onClose: () => void; onDone: Done }) {
  const [date, setDate] = useState(booking.date);
  const [time, setTime] = useState(booking.time);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      // staffId omitted keeps whoever is assigned; the server checks they're free.
      const updated = await api<Booking>(`/bookings/${booking.bookingId}/reschedule`, { method: 'POST', body: { date, time } });
      toast.success('Appointment moved. The customer gets an SMS with the new time.');
      onDone(updated);
      onClose();
    } catch (err) {
      setError(
        err instanceof ApiError && err.code === 'slot_unavailable'
          ? `${booking.staffId ? booking.staffName : 'No one'} is free then. Pick another time, or reassign first.`
          : errorMessage(err, "Couldn't move this appointment."),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Reschedule"
      locked={saving}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} loading={saving} disabled={!date || !time || (date === booking.date && time === booking.time)}>
            Move appointment
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4 pb-2">
        <p className="text-sm text-ink-2">Any time within working hours, on the slot grid or not. A confirmed booking&apos;s customer gets an SMS.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input label="Date" type="date" min={today} value={date} onChange={(e) => setDate(e.target.value)} />
          <Input label="Time" type="time" step={300} value={time} onChange={(e) => setTime(e.target.value)} />
        </div>
        <InlineError>{error}</InlineError>
      </div>
    </Modal>
  );
}

// Record that the business sent back a refund it owed (mark-refunded).
export function RefundModal({ booking, open, onClose, onDone }: { booking: Booking; open: boolean; onClose: () => void; onDone: Done }) {
  const [reference, setReference] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const updated = await api<Booking>(`/bookings/${booking.bookingId}/refund`, { method: 'POST', body: { reference: reference.trim() || null } });
      toast.success('Refund marked as paid');
      onDone(updated);
      onClose();
    } catch (err) {
      setError(errorMessage(err, "Couldn't record the refund."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Mark refund paid"
      locked={saving}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} loading={saving}>
            Mark paid
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4 pb-2">
        <p className="text-ink-2">
          Send {booking.refund ? money(booking.refund.amount) : 'the refund'} back to {booking.customerName} yourself (e.g. M-Pesa), then record it here.
        </p>
        <Input label="Reference (optional)" placeholder="e.g. SJK4R2T8QX" value={reference} onChange={(e) => setReference(e.target.value.toUpperCase())} maxLength={64} />
        <InlineError>{error}</InlineError>
      </div>
    </Modal>
  );
}

// The business cancels: any paid deposit becomes a refund owed.
export function CancelModal({ booking, open, onClose, onDone }: { booking: Booking; open: boolean; onClose: () => void; onDone: Done }) {
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const updated = await api<Booking>(`/bookings/${booking.bookingId}/status`, {
        method: 'PATCH',
        body: { status: 'cancelled', reason: reason.trim() || null },
      });
      toast('Appointment cancelled');
      onDone(updated);
      onClose();
    } catch (err) {
      setError(errorMessage(err, "Couldn't cancel this appointment."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Cancel appointment?"
      locked={saving}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Keep it
          </Button>
          <Button variant="danger" onClick={save} loading={saving}>
            Cancel appointment
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4 pb-2">
        <p className="text-ink-2">
          {booking.customerName}&apos;s appointment will be cancelled
          {booking.depositPaid ? `, and their ${money(booking.depositPaid)} deposit becomes a refund you owe them` : ''}.
        </p>
        <Textarea label="Reason (optional)" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} />
        <InlineError>{error}</InlineError>
      </div>
    </Modal>
  );
}
