'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { toast } from '@/components/ui/toast';
import { useWork, workHref } from '@/components/work/context';
import { api, ApiError, errorMessage } from '@/lib/api';
import { cx, money, timeLabel } from '@/lib/format';
import type { Booking } from '@/types/booking';
import type { Visit, WorkBusiness } from '@/types/work-daily';
import { InlineError, Segmented, StatusBadge } from './bits';
import { staffForServices } from './use-business';

// Visits: a customer having hair done wants nails too, maybe by someone else.
// Add the service (now, right after, or at a time today), see the visit's
// parts together, and check it all out in one payment with the tip split
// between the staff the way the customer wants (checkout.tsx).


// ─── Add a service ───────────────────────────────────────────

export function AddServiceModal({
  booking, business, open, onClose, onDone,
}: { booking: Booking; business: WorkBusiness | null; open: boolean; onClose: () => void; onDone: (visit: Visit) => void }) {
  const [serviceId, setServiceId] = useState('');
  const [staffId, setStaffId] = useState('');
  const [start, setStart] = useState<'now' | 'after' | 'at'>('now');
  const [time, setTime] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [nextFree, setNextFree] = useState<string | null>(null);

  const services = business?.services ?? [];
  const able = business && serviceId ? staffForServices(business, [serviceId]) : [];

  const submit = async (override?: { start: 'at'; time: string }) => {
    setError('');
    setNextFree(null);
    const when = override ?? { start, time };
    if (!serviceId || !staffId) return setError('Pick the service and who does it.');
    if (when.start === 'at' && !when.time) return setError('Pick a time.');
    setSaving(true);
    try {
      const visit = await api<Visit>(`/bookings/${booking.bookingId}/add-service`, {
        method: 'POST',
        body: { services: [{ serviceId, quantity: 1 }], staffId, start: when.start, ...(when.start === 'at' ? { time: when.time } : {}) },
      });
      toast.success('Added to the visit');
      onDone(visit);
      onClose();
    } catch (err) {
      if (err instanceof ApiError && err.code === 'slot_unavailable') {
        const free = (err.body as { nextFreeAt?: string | null } | null)?.nextFreeAt ?? null;
        setNextFree(free);
        setError(free ? `They're busy then. They're free from ${timeLabel(free)}.` : "They're busy for the rest of today. Choose someone else.");
      } else {
        setError(errorMessage(err, "Couldn't add the service."));
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add a service"
      locked={saving}
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          {nextFree ? (
            <Button variant="secondary" onClick={() => { setStart('at'); setTime(nextFree); submit({ start: 'at', time: nextFree }); }} disabled={saving}>
              Start at {timeLabel(nextFree)}
            </Button>
          ) : null}
          <Button onClick={() => submit()} loading={saving}>Add to visit</Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4 pb-2">
        <p className="text-sm text-ink-2">
          For {booking.customerName}, on the same visit: everything is paid together at checkout.
        </p>
        <Select label="Service" value={serviceId} onChange={(e) => { setServiceId(e.target.value); setStaffId(''); }}>
          <option value="">Choose a service</option>
          {services.map((s) => (
            <option key={s.serviceId} value={s.serviceId}>
              {s.name} · {s.durationMinutes} min · {money(s.price)}
            </option>
          ))}
        </Select>
        <Select label="Who does it" value={staffId} onChange={(e) => setStaffId(e.target.value)} disabled={!serviceId}>
          <option value="">{serviceId ? (able.length ? 'Choose someone' : 'Nobody offers this service') : 'Choose the service first'}</option>
          {able.map((m) => (
            <option key={m.staffId} value={m.staffId}>
              {m.name}{m.staffId === booking.staffId ? ' (same person)' : ''}
            </option>
          ))}
        </Select>
        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold">When</p>
          <Segmented
            label="When"
            value={start}
            onChange={setStart}
            options={[
              { key: 'now', label: 'Now, alongside' },
              { key: 'after', label: 'Right after this' },
              { key: 'at', label: 'At a time' },
            ]}
          />
          {start === 'at' ? <Input label="Time today" type="time" value={time} onChange={(e) => setTime(e.target.value)} className="max-w-40" /> : null}
        </div>
        <InlineError>{error}</InlineError>
      </div>
    </Modal>
  );
}

// ─── The visit's other parts ─────────────────────────────────

export function VisitParts({ visit, currentBookingId }: { visit: Visit; currentBookingId: string }) {
  const { businessId } = useWork();
  return (
    <ul className="flex flex-col gap-2">
      {visit.bookings.map((b) => {
        const current = b.bookingId === currentBookingId;
        const row = (
          <div className={cx('flex items-center justify-between gap-3 rounded-2xl px-4 py-3', current ? 'bg-accent-soft/60' : 'bg-ink/[0.03] hover:bg-ink/[0.06]')}>
            <div className="min-w-0">
              <p className="truncate font-semibold">{b.services.map((s) => s.name).join(', ')}</p>
              <p className="text-sm text-ink-2">
                {b.staffName} · {timeLabel(b.time)}{current ? ' · this one' : ''}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <StatusBadge status={b.status} />
              <span className="tabular-nums text-sm font-semibold">{money(b.totalAmount)}</span>
            </div>
          </div>
        );
        return <li key={b.bookingId}>{current ? row : <Link href={workHref(businessId, `appointments/${b.bookingId}`)}>{row}</Link>}</li>;
      })}
      <li className="flex items-baseline justify-between px-1 pt-1 text-sm">
        <span className="text-ink-2">Visit total</span>
        <span className="font-semibold tabular-nums">{money(visit.total)}</span>
      </li>
    </ul>
  );
}
