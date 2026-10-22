'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Spinner } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { toast } from '@/components/ui/toast';
import { useWork, workHref } from '@/components/work/context';
import { api, ApiError, errorMessage } from '@/lib/api';
import { cx, money, timeLabel } from '@/lib/format';
import { splitTip, type TipMode } from '@/lib/tipSplit';
import type { Booking, PaymentMethod } from '@/types/booking';
import type { ChargeStarted, Visit, WorkBusiness } from '@/types/work-daily';
import { InlineError, Segmented, StatusBadge, SummaryRow } from './bits';
import { formatPhone, normalizePhone, PHONE_HINT } from './phone';
import { failureMessage } from './status';
import { staffForServices } from './use-business';

// Visits: a customer having hair done wants nails too, maybe by someone else.
// Add the service (now, right after, or at a time today), see the visit's
// parts together, and check it all out in one payment with the tip split
// between the staff the way the customer wants.

const TIP_PRESETS = [0, 100, 200, 500];
const POLL_MS = 3000;
const POLL_LIMIT_MS = 2 * 60 * 1000;

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

// ─── Check the whole visit out ───────────────────────────────

export function VisitChargeModal({
  visit, open, onClose, onDone,
}: { visit: Visit; open: boolean; onClose: () => void; onDone: (visit: Visit) => void }) {
  const [method, setMethod] = useState<PaymentMethod>('mpesa');
  const [phone, setPhone] = useState(formatPhone(visit.customerPhone));
  const [tipPreset, setTipPreset] = useState(0);
  const [tipOther, setTipOther] = useState('');
  const [mode, setMode] = useState<TipMode>('even');
  const [custom, setCustom] = useState<Record<string, string>>({});
  const [onlyReady, setOnlyReady] = useState(false);
  const [step, setStep] = useState<'form' | 'pending' | 'success'>('form');
  const [error, setError] = useState('');
  const [charged, setCharged] = useState<{ amount: number; method: PaymentMethod } | null>(null);
  const polling = useRef(0);
  useEffect(() => () => void (polling.current += 1), []);

  // Who's being paid for now: everyone, or just the started/finished parts.
  const charging = useMemo(() => {
    const ids = new Set(onlyReady ? visit.chargeableBookingIds : visit.bookings.filter((b) => b.paymentStatus !== 'paid' && b.status !== 'cancelled' && b.status !== 'no_show').map((b) => b.bookingId));
    return visit.bookings.filter((b) => ids.has(b.bookingId));
  }, [visit, onlyReady]);
  const balance = charging.reduce((sum, b) => sum + (b.balanceDue?.amount ?? 0), 0);
  // People to tip, in visit order, with what their services come to (for "by service").
  const people = useMemo(() => {
    const seen = new Map<string, { staffId: string; name: string; value: number }>();
    for (const b of charging) {
      if (!b.staffId) continue;
      const row = seen.get(b.staffId) ?? { staffId: b.staffId, name: b.staffName, value: 0 };
      row.value += b.totalAmount.amount;
      seen.set(b.staffId, row);
    }
    return [...seen.values()];
  }, [charging]);

  const tipTotal = mode === 'custom'
    ? people.reduce((sum, p) => sum + (Number(custom[p.staffId]) || 0), 0)
    : tipOther ? Number(tipOther) || 0 : tipPreset;
  const shares = mode === 'custom'
    ? Object.fromEntries(people.map((p) => [p.staffId, Number(custom[p.staffId]) || 0]))
    : splitTip(tipTotal, people, mode);
  const total = balance + tipTotal;
  const notReady = visit.notReady.length > 0 && !onlyReady;

  const close = () => {
    polling.current += 1;
    setStep('form');
    setError('');
    onClose();
  };

  const waitForVisit = async () => {
    const run = ++polling.current;
    const started = Date.now();
    while (Date.now() - started < POLL_LIMIT_MS) {
      await new Promise((r) => setTimeout(r, POLL_MS));
      if (run !== polling.current) return;
      const v = await api<Visit>(`/visits/${visit.visitId}`).catch(() => null);
      if (run !== polling.current) return;
      if (!v) continue;
      const allPaid = charging.every((b) => v.bookings.find((x) => x.bookingId === b.bookingId)?.paymentStatus === 'paid');
      if (allPaid) {
        setStep('success');
        return onDone(v);
      }
      const attempt = v.chargePayment;
      if (attempt && (attempt.status === 'failed' || attempt.status === 'timeout')) {
        onDone(v);
        setError(`${failureMessage(attempt.failureReason)} Try again or take cash.`);
        return setStep('form');
      }
    }
    setError(`${failureMessage('timeout')} Try again or take cash.`);
    setStep('form');
  };

  const submit = async () => {
    setError('');
    if (tipTotal < 0 || tipTotal > 100000) return setError('Enter a tip between 0 and 100,000.');
    let normalized: string | null = null;
    if (method === 'mpesa') {
      normalized = normalizePhone(phone);
      if (!normalized) return setError(`Enter the customer's M-Pesa number (${PHONE_HINT}).`);
    }
    const tips = people.filter((p) => shares[p.staffId] > 0).map((p) => ({ staffId: p.staffId, amount: shares[p.staffId] }));
    setCharged({ amount: total, method });
    setStep('pending');
    try {
      const res = await api<Visit | (ChargeStarted & { visitId: string })>(`/visits/${visit.visitId}/charge`, {
        method: 'POST',
        body: {
          method, tips,
          ...(normalized ? { phone: normalized } : {}),
          ...(onlyReady ? { bookingIds: charging.map((b) => b.bookingId) } : {}),
        },
      });
      if ('bookings' in res) {
        setStep('success');
        return onDone(res);
      }
      await waitForVisit();
    } catch (err) {
      if (err instanceof ApiError && err.code === 'payment_in_progress') return waitForVisit();
      if (err instanceof ApiError && err.code === 'visit_not_ready') {
        setOnlyReady(true);
        setError('Some services haven’t started yet. Charging what’s done now; the rest can be paid when it’s finished.');
      } else {
        setError(errorMessage(err, "Couldn't charge the customer."));
      }
      setStep('form');
    }
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title={step === 'form' ? 'Check out the visit' : undefined}
      locked={step === 'pending'}
      wide
      footer={
        step === 'form' ? (
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={close}>Cancel</Button>
            <Button onClick={submit} disabled={!charging.length}>
              {method === 'mpesa' ? `Send one M-Pesa prompt · ${money(total)}` : `Record cash · ${money(total)}`}
            </Button>
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
              <p className="max-w-xs text-ink-2">One prompt for {money(charged.amount)} went to {phone}. Waiting for their PIN.</p>
              <Button variant="ghost" size="sm" onClick={close}>Stop waiting</Button>
            </>
          ) : (
            <p className="text-lg font-bold">Recording payment…</p>
          )}
        </div>
      ) : step === 'success' ? (
        <div className="flex flex-col items-center gap-3 py-10 text-center" aria-live="polite">
          <span className="grid size-14 place-items-center rounded-full bg-success/10 text-2xl text-success" aria-hidden>✓</span>
          <p className="text-lg font-bold">{charged?.method === 'cash' ? 'Cash recorded' : 'Payment received'}</p>
          <p className="text-ink-2">{charged ? money(charged.amount) : ''} from {visit.customerName}. Tips are in each person&apos;s wallet.</p>
          <Button onClick={close} className="mt-2">Done</Button>
        </div>
      ) : (
        <div className="flex flex-col gap-5 pb-2">
          <div className="rounded-2xl bg-ink/[0.03] px-4 py-3">
            {charging.map((b) => (
              <SummaryRow key={b.bookingId} label={`${b.services.map((s) => s.name).join(', ')} · ${b.staffName}`} value={money(b.balanceDue ?? b.totalAmount)} />
            ))}
            {tipTotal > 0 ? <SummaryRow muted label="Tips" value={money(tipTotal)} /> : null}
            <SummaryRow strong label="To pay now" value={money(total)} />
          </div>
          {notReady ? (
            <p className="text-sm text-warning">
              Not started yet: {visit.notReady.map((n) => n.staffName).join(', ')}. Start it first, or{' '}
              <button type="button" className="font-semibold underline" onClick={() => setOnlyReady(true)}>charge what&apos;s done now</button>.
            </p>
          ) : null}

          <div className="flex flex-col gap-2">
            <p className="text-sm font-semibold">Payment method</p>
            <Segmented label="Payment method" value={method} onChange={setMethod} options={[{ key: 'mpesa', label: 'M-Pesa' }, { key: 'cash', label: 'Cash' }]} />
          </div>
          {method === 'mpesa' ? (
            <Input label="Customer's M-Pesa number" type="tel" inputMode="tel" placeholder="0712 345 678" value={phone} onChange={(e) => setPhone(e.target.value)} hint="One prompt for everything." />
          ) : null}

          {people.length ? (
            <div className="flex flex-col gap-3">
              <p className="text-sm font-semibold">Tip (optional)</p>
              <Segmented
                label="Split the tip"
                value={mode}
                onChange={setMode}
                options={[{ key: 'even', label: 'Split evenly' }, { key: 'value', label: 'By service' }, { key: 'custom', label: 'Custom amounts' }]}
              />
              {mode !== 'custom' ? (
                <>
                  <Segmented
                    label="Tip total"
                    value={tipOther ? null : tipPreset}
                    onChange={(v) => { setTipOther(''); setTipPreset(v); }}
                    options={TIP_PRESETS.map((a) => ({ key: a, label: a === 0 ? 'None' : `${a}` }))}
                  />
                  <Input label="Other total (KSh)" inputMode="numeric" value={tipOther} onChange={(e) => setTipOther(e.target.value.replace(/\D/g, '').slice(0, 6))} className="max-w-56" />
                </>
              ) : null}
              <ul className="flex flex-col gap-2">
                {people.map((p) => (
                  <li key={p.staffId} className="flex items-center justify-between gap-3 rounded-2xl bg-ink/[0.03] px-4 py-2">
                    <span className="font-medium">{p.name}</span>
                    {mode === 'custom' ? (
                      <input
                        inputMode="numeric"
                        aria-label={`Tip for ${p.name}`}
                        value={custom[p.staffId] ?? ''}
                        onChange={(e) => setCustom((c) => ({ ...c, [p.staffId]: e.target.value.replace(/\D/g, '').slice(0, 6) }))}
                        placeholder="0"
                        className="w-28 rounded-xl border border-line-2 bg-white px-3 py-2 text-right tabular-nums outline-none focus:border-ink focus:ring-4 focus:ring-accent-soft"
                      />
                    ) : (
                      <span className="tabular-nums font-semibold">{money(shares[p.staffId] ?? 0)}</span>
                    )}
                  </li>
                ))}
              </ul>
              <p className="text-xs text-ink-2">Each share goes to that person&apos;s wallet; tips aren&apos;t revenue.</p>
            </div>
          ) : null}
          <InlineError>{error}</InlineError>
        </div>
      )}
    </Modal>
  );
}
