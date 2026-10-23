'use client';

import { useState } from 'react';
import { Button, Spinner } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { toast } from '@/components/ui/toast';
import { api, ApiError, errorMessage } from '@/lib/api';
import { cx, money } from '@/lib/format';
import type { Booking } from '@/types/booking';
import type { WorkBusiness } from '@/types/work-daily';
import { InlineError } from './bits';
import { staffForServices } from './use-business';

// The Appointment panel's dialogs: assign staff, reschedule, mark refund
// paid, cancel. Each calls back with the updated Booking. (Charging is its
// own page: checkout.tsx.)

type Done = (booking: Booking) => void;

export function balanceOf(b: Booking): number {
  return (b.balanceDue ?? { amount: b.totalAmount.amount - (b.depositPaid?.amount ?? 0) }).amount;
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
