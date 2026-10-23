'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Spinner } from '@/components/ui/button';
import { Input } from '@/components/ui/field';
import { Avatar } from '@/components/ui/misc';
import { useWork, workHref } from '@/components/work/context';
import { api, ApiError, errorMessage } from '@/lib/api';
import { cx, money } from '@/lib/format';
import { splitTip, type TipMode } from '@/lib/tipSplit';
import type { Booking, PaymentMethod } from '@/types/booking';
import type { ChargeStarted, Visit } from '@/types/work-daily';
import { InlineError, Loading, LoadError, Segmented, SummaryRow } from './bits';
import { formatPhone, normalizePhone, PHONE_HINT } from './phone';
import { failureMessage, PAYMENT_METHOD_LABEL } from './status';
import { useApi } from './use-api';

// Checkout as its own page (front desk and owner): the order on the left, the
// payment on the right, a live M-Pesa status while the customer enters their
// PIN, then a receipt. /checkout/[bookingId] for one appointment; a booking
// that's part of a multi-staff visit goes to /checkout/visit/[visitId], one
// payment for everything with the tip split between the staff.

const TIP_PRESETS = [0, 100, 200, 500];
const POLL_MS = 3000;
const POLL_LIMIT_MS = 2 * 60 * 1000;

type Phase = 'form' | 'pending' | 'paid';
type Poll = () => Promise<'paid' | { failed: string | null } | null>; // null: not yet

// Start a charge, then (for M-Pesa) poll until paid, failed or timed out.
// Leaving the page stops the polling; the payment itself carries on and the
// booking updates when it lands.
function usePayment() {
  const [phase, setPhase] = useState<Phase>('form');
  const [error, setError] = useState('');
  const [sent, setSent] = useState<{ amount: number; method: PaymentMethod; phone: string } | null>(null);
  const run = useRef(0);
  useEffect(() => () => void (run.current += 1), []);

  const wait = async (poll: Poll) => {
    const mine = ++run.current;
    const started = Date.now();
    while (Date.now() - started < POLL_LIMIT_MS) {
      await new Promise((r) => setTimeout(r, POLL_MS));
      if (mine !== run.current) return;
      const result = await poll().catch(() => null); // a dropped poll isn't an outcome
      if (mine !== run.current) return;
      if (result === 'paid') return setPhase('paid');
      if (result && 'failed' in result) {
        setError(`${failureMessage(result.failed)} Try again or take cash.`);
        return setPhase('form');
      }
    }
    setError(`${failureMessage('timeout')} Try again or take cash.`);
    setPhase('form');
  };

  const pay = async (args: { amount: number; method: PaymentMethod; phone: string; start: () => Promise<'paid' | 'started'>; poll: Poll }) => {
    setError('');
    setSent({ amount: args.amount, method: args.method, phone: args.phone });
    setPhase('pending');
    try {
      if ((await args.start()) === 'paid') return setPhase('paid');
      await wait(args.poll);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'payment_in_progress') return wait(args.poll);
      setError(errorMessage(err, "Couldn't take the payment."));
      setPhase('form');
    }
  };

  const stop = () => {
    run.current += 1;
    setPhase('form');
  };

  return { phase, error, setError, sent, pay, stop };
}

// ─── One appointment ─────────────────────────────────────────

export function BookingCheckout({ bookingId }: { bookingId: string }) {
  const router = useRouter();
  const { businessId } = useWork();
  const { data: booking, error, reload } = useApi<Booking>(`/bookings/${bookingId}`);

  // Part of a visit: everything is paid together there.
  useEffect(() => {
    if (booking?.visitId) router.replace(workHref(businessId, `checkout/visit/${booking.visitId}`));
  }, [booking?.visitId, businessId, router]);

  if (!booking) return error ? <LoadError error={error} onRetry={reload} title="Couldn't load this appointment" /> : <Loading />;
  if (booking.visitId) return <Loading />;
  return <BookingCheckoutForm booking={booking} onPaid={reload} />;
}

function BookingCheckoutForm({ booking, onPaid }: { booking: Booking; onPaid: () => void }) {
  const [method, setMethod] = useState<PaymentMethod>('mpesa');
  const [phone, setPhone] = useState(formatPhone(booking.customerPhone));
  const [tip, setTip] = useState(0);
  const [tipOther, setTipOther] = useState('');
  const flow = usePayment();
  const balance = booking.balanceDue?.amount ?? Math.max(booking.totalAmount.amount - (booking.depositPaid?.amount ?? 0), 0);
  const tipAmount = booking.staffId ? (tipOther ? Number(tipOther) || 0 : tip) : 0;
  const total = balance + tipAmount;

  if (booking.paymentStatus === 'paid' && flow.phase !== 'pending') {
    return <Receipt title={booking.customerName} bookings={[booking]} />;
  }

  const submit = () => {
    if (tipAmount > 100000) return flow.setError('Tips can be at most KSh 100,000.');
    const normalized = method === 'mpesa' ? normalizePhone(phone) : null;
    if (method === 'mpesa' && !normalized) return flow.setError(`Enter the customer's M-Pesa number (${PHONE_HINT}).`);
    flow.pay({
      amount: total,
      method,
      phone,
      start: async () => {
        const res = await api<Booking | ChargeStarted>(`/bookings/${booking.bookingId}/charge`, {
          method: 'POST',
          body: { method, ...(normalized ? { phone: normalized } : {}), ...(tipAmount ? { tip: tipAmount } : {}) },
        });
        if ('totalAmount' in res) {
          onPaid();
          return 'paid';
        }
        return 'started';
      },
      poll: async () => {
        const b = await api<Booking>(`/bookings/${booking.bookingId}`);
        if (b.paymentStatus === 'paid') {
          onPaid();
          return 'paid';
        }
        const attempt = b.chargePayment;
        return attempt && (attempt.status === 'failed' || attempt.status === 'timeout') ? { failed: attempt.failureReason } : null;
      },
    });
  };

  return (
    <CheckoutLayout
      title={booking.customerName}
      order={
        <OrderCard
          lines={booking.services.map((s) => ({
            key: s.serviceId ?? s.name,
            label: `${s.quantity > 1 ? `${s.quantity}× ` : ''}${s.name}`,
            amount: s.price.amount * s.quantity,
          }))}
          staff={booking.staffId ? [{ name: booking.staffName, avatarUrl: booking.staffAvatarUrl }] : []}
          total={booking.totalAmount.amount}
          deposit={booking.depositPaid?.amount ?? 0}
          balance={balance}
        />
      }
      flow={flow}
      payment={
        <PaymentCard
          method={method}
          setMethod={setMethod}
          phone={phone}
          setPhone={setPhone}
          total={total}
          error={flow.error}
          onSubmit={submit}
          tips={
            booking.staffId ? (
              <div className="flex flex-col gap-2">
                <p className="text-sm font-semibold">Tip for {booking.staffName} (optional)</p>
                <Segmented
                  label="Tip"
                  value={tipOther ? null : tip}
                  onChange={(v) => { setTipOther(''); setTip(v); }}
                  options={TIP_PRESETS.map((a) => ({ key: a, label: a === 0 ? 'None' : `${a}` }))}
                />
                <Input label="Other amount (KSh)" inputMode="numeric" value={tipOther} onChange={(e) => setTipOther(e.target.value.replace(/\D/g, '').slice(0, 6))} />
              </div>
            ) : (
              <p className="text-sm text-ink-2">Assign someone to this appointment to add a tip for them.</p>
            )
          }
        />
      }
    />
  );
}

// ─── A multi-staff visit ─────────────────────────────────────

export function VisitCheckout({ visitId }: { visitId: string }) {
  const { data: visit, error, reload, setData } = useApi<Visit>(`/visits/${visitId}`);
  if (!visit) return error ? <LoadError error={error} onRetry={reload} title="Couldn't load this visit" /> : <Loading />;
  return <VisitCheckoutForm visit={visit} onVisit={(v) => setData(() => v)} reload={reload} />;
}

function VisitCheckoutForm({ visit, onVisit, reload }: { visit: Visit; onVisit: (v: Visit) => void; reload: () => void }) {
  const [method, setMethod] = useState<PaymentMethod>('mpesa');
  const [phone, setPhone] = useState(formatPhone(visit.customerPhone));
  const [mode, setMode] = useState<TipMode>('even');
  const [tipPreset, setTipPreset] = useState(0);
  const [tipOther, setTipOther] = useState('');
  const [custom, setCustom] = useState<Record<string, string>>({});
  const [onlyReady, setOnlyReady] = useState(false);
  const flow = usePayment();

  const charging = useMemo(() => {
    const unpaid = visit.bookings.filter((b) => b.paymentStatus !== 'paid' && b.status !== 'cancelled' && b.status !== 'no_show');
    return onlyReady ? unpaid.filter((b) => visit.chargeableBookingIds.includes(b.bookingId)) : unpaid;
  }, [visit, onlyReady]);
  const people = useMemo(() => {
    const byStaff = new Map<string, { staffId: string; name: string; avatarUrl?: string | null; value: number }>();
    for (const b of charging) {
      if (!b.staffId) continue;
      const row = byStaff.get(b.staffId) ?? { staffId: b.staffId, name: b.staffName, avatarUrl: b.staffAvatarUrl, value: 0 };
      row.value += b.totalAmount.amount;
      byStaff.set(b.staffId, row);
    }
    return [...byStaff.values()];
  }, [charging]);
  const balance = charging.reduce((sum, b) => sum + (b.balanceDue?.amount ?? 0), 0);
  const tipTotal = mode === 'custom'
    ? people.reduce((sum, p) => sum + (Number(custom[p.staffId]) || 0), 0)
    : tipOther ? Number(tipOther) || 0 : tipPreset;
  const shares: Record<string, number> = mode === 'custom'
    ? Object.fromEntries(people.map((p) => [p.staffId, Number(custom[p.staffId]) || 0]))
    : splitTip(tipTotal, people, mode);
  const total = balance + tipTotal;

  if (visit.paymentStatus === 'paid' && flow.phase !== 'pending') {
    return <Receipt title={visit.customerName} bookings={visit.bookings.filter((b) => b.status !== 'cancelled' && b.status !== 'no_show')} />;
  }

  const submit = () => {
    if (tipTotal > 100000) return flow.setError('Tips can be at most KSh 100,000.');
    const normalized = method === 'mpesa' ? normalizePhone(phone) : null;
    if (method === 'mpesa' && !normalized) return flow.setError(`Enter the customer's M-Pesa number (${PHONE_HINT}).`);
    const ids = charging.map((b) => b.bookingId);
    flow.pay({
      amount: total,
      method,
      phone,
      start: async () => {
        try {
          const res = await api<Visit | (ChargeStarted & { visitId: string })>(`/visits/${visit.visitId}/charge`, {
            method: 'POST',
            body: {
              method,
              tips: people.filter((p) => shares[p.staffId] > 0).map((p) => ({ staffId: p.staffId, amount: shares[p.staffId] })),
              ...(normalized ? { phone: normalized } : {}),
              ...(onlyReady ? { bookingIds: ids } : {}),
            },
          });
          if ('bookings' in res) {
            onVisit(res);
            return 'paid';
          }
          return 'started';
        } catch (err) {
          if (err instanceof ApiError && err.code === 'visit_not_ready') {
            setOnlyReady(true);
            throw new ApiError(409, 'visit_not_ready', 'Some services haven’t started yet. Charging what’s done now; the rest can be paid when it’s finished.');
          }
          throw err;
        }
      },
      poll: async () => {
        const v = await api<Visit>(`/visits/${visit.visitId}`);
        if (ids.every((id) => v.bookings.find((b) => b.bookingId === id)?.paymentStatus === 'paid')) {
          onVisit(v);
          return 'paid';
        }
        const attempt = v.chargePayment;
        return attempt && (attempt.status === 'failed' || attempt.status === 'timeout') ? { failed: attempt.failureReason } : null;
      },
    });
  };

  return (
    <CheckoutLayout
      title={visit.customerName}
      order={
        <OrderCard
          lines={charging.map((b) => ({
            key: b.bookingId,
            label: b.services.map((s) => s.name).join(', '),
            sub: b.staffName,
            avatar: { name: b.staffName, avatarUrl: b.staffAvatarUrl },
            amount: b.balanceDue?.amount ?? b.totalAmount.amount,
          }))}
          total={charging.reduce((sum, b) => sum + b.totalAmount.amount, 0)}
          deposit={charging.reduce((sum, b) => sum + (b.depositPaid?.amount ?? 0), 0)}
          balance={balance}
          note={
            visit.notReady.length && !onlyReady ? (
              <p className="text-sm text-warning">
                Not started yet: {visit.notReady.map((n) => n.staffName).join(', ')}.{' '}
                <button type="button" className="font-semibold underline" onClick={() => setOnlyReady(true)}>Charge what&apos;s done now</button>
              </p>
            ) : null
          }
        />
      }
      flow={flow}
      payment={
        <PaymentCard
          method={method}
          setMethod={setMethod}
          phone={phone}
          setPhone={setPhone}
          total={total}
          error={flow.error}
          onSubmit={submit}
          disabled={!charging.length}
          tips={
            people.length ? (
              <div className="flex flex-col gap-3">
                <p className="text-sm font-semibold">Tip (optional)</p>
                <Segmented
                  label="Split the tip"
                  value={mode}
                  onChange={setMode}
                  options={[{ key: 'even', label: 'Split evenly' }, { key: 'value', label: 'By service' }, { key: 'custom', label: 'Custom' }]}
                />
                {mode !== 'custom' ? (
                  <>
                    <Segmented
                      label="Tip total"
                      value={tipOther ? null : tipPreset}
                      onChange={(v) => { setTipOther(''); setTipPreset(v); }}
                      options={TIP_PRESETS.map((a) => ({ key: a, label: a === 0 ? 'None' : `${a}` }))}
                    />
                    <Input label="Other total (KSh)" inputMode="numeric" value={tipOther} onChange={(e) => setTipOther(e.target.value.replace(/\D/g, '').slice(0, 6))} />
                  </>
                ) : null}
                <ul className="flex flex-col gap-2">
                  {people.map((p) => (
                    <li key={p.staffId} className="flex items-center gap-3 rounded-2xl bg-ink/[0.03] px-3 py-2">
                      <Avatar name={p.name} src={p.avatarUrl} size={28} />
                      <span className="flex-1 font-medium">{p.name}</span>
                      {mode === 'custom' ? (
                        <input
                          inputMode="numeric"
                          aria-label={`Tip for ${p.name}`}
                          value={custom[p.staffId] ?? ''}
                          onChange={(e) => setCustom((c) => ({ ...c, [p.staffId]: e.target.value.replace(/\D/g, '').slice(0, 6) }))}
                          placeholder="0"
                          className="w-24 rounded-xl border border-line-2 bg-white px-3 py-1.5 text-right tabular-nums outline-none focus:border-ink focus:ring-4 focus:ring-accent-soft"
                        />
                      ) : (
                        <span className="font-semibold tabular-nums">{money(shares[p.staffId] ?? 0)}</span>
                      )}
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-ink-2">Each share goes to that person&apos;s wallet; tips aren&apos;t revenue.</p>
              </div>
            ) : null
          }
        />
      }
      onRetryLoad={reload}
    />
  );
}

// ─── Layout pieces ───────────────────────────────────────────

function CheckoutLayout({
  title, order, payment, flow,
}: {
  title: string;
  order: React.ReactNode;
  payment: React.ReactNode;
  flow: ReturnType<typeof usePayment>;
  onRetryLoad?: () => void;
}) {
  const { businessId } = useWork();
  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href={workHref(businessId, 'today')} className="text-sm font-semibold text-ink-2 hover:text-ink">← Today</Link>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Checkout · {title}</h1>
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
        <div>{order}</div>
        <div>{flow.phase === 'pending' && flow.sent ? <PendingCard sent={flow.sent} onStop={flow.stop} /> : payment}</div>
      </div>
    </div>
  );
}

function OrderCard({
  lines, staff, total, deposit, balance, note,
}: {
  lines: { key: string; label: string; sub?: string; avatar?: { name: string; avatarUrl?: string | null }; amount: number }[];
  staff?: { name: string; avatarUrl?: string | null }[];
  total: number;
  deposit: number;
  balance: number;
  note?: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl bg-white p-6 ring-1 ring-ink/5">
      <h2 className="text-sm font-semibold tracking-wide text-ink-2 uppercase">Order</h2>
      {staff?.length ? (
        <div className="mt-3 flex items-center gap-2 text-sm text-ink-2">
          <Avatar name={staff[0].name} src={staff[0].avatarUrl} size={24} /> with {staff[0].name}
        </div>
      ) : null}
      <ul className="mt-4 flex flex-col divide-y divide-line">
        {lines.map((l) => (
          <li key={l.key} className="flex items-center gap-3 py-3">
            {l.avatar ? <Avatar name={l.avatar.name} src={l.avatar.avatarUrl} size={32} /> : null}
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{l.label}</p>
              {l.sub ? <p className="text-sm text-ink-2">{l.sub}</p> : null}
            </div>
            <span className="tabular-nums">{money(l.amount)}</span>
          </li>
        ))}
      </ul>
      <div className="mt-2 border-t border-line pt-3">
        <SummaryRow label="Total" value={money(total)} />
        {deposit ? <SummaryRow muted label="Deposit already paid" value={`− ${money(deposit)}`} /> : null}
        <SummaryRow strong label="Balance" value={money(balance)} />
      </div>
      {note ? <div className="mt-3">{note}</div> : null}
    </section>
  );
}

function PaymentCard({
  method, setMethod, phone, setPhone, total, tips, error, onSubmit, disabled,
}: {
  method: PaymentMethod;
  setMethod: (m: PaymentMethod) => void;
  phone: string;
  setPhone: (p: string) => void;
  total: number;
  tips: React.ReactNode;
  error: string;
  onSubmit: () => void;
  disabled?: boolean;
}) {
  return (
    <section className="flex flex-col gap-5 rounded-3xl bg-white p-6 ring-1 ring-ink/5 lg:sticky lg:top-6">
      <div className="flex flex-col gap-2">
        <p className="text-sm font-semibold">Payment method</p>
        <Segmented label="Payment method" value={method} onChange={setMethod} options={[{ key: 'mpesa', label: 'M-Pesa' }, { key: 'cash', label: 'Cash' }]} />
      </div>
      {method === 'mpesa' ? (
        <Input label="Customer's M-Pesa number" type="tel" inputMode="tel" placeholder="0712 345 678" value={phone} onChange={(e) => setPhone(e.target.value)} hint="They get one prompt to enter their PIN." />
      ) : null}
      {tips}
      <InlineError>{error}</InlineError>
      <div className="border-t border-line pt-4">
        <SummaryRow strong label="To pay now" value={money(total)} />
        <Button variant="brand" size="lg" arrow className="mt-3 w-full justify-between pl-6" onClick={onSubmit} disabled={disabled}>
          {method === 'mpesa' ? 'Send M-Pesa prompt' : 'Record cash payment'}
        </Button>
      </div>
    </section>
  );
}

function PendingCard({ sent, onStop }: { sent: { amount: number; method: PaymentMethod; phone: string }; onStop: () => void }) {
  return (
    <section className="flex flex-col items-center gap-4 rounded-3xl bg-white p-8 text-center ring-1 ring-ink/5" aria-live="polite">
      <Spinner className="size-9 text-brand" />
      {sent.method === 'mpesa' ? (
        <>
          <p className="text-xl font-bold">Waiting for the customer&apos;s PIN</p>
          <ol className="flex flex-col gap-1 text-sm text-ink-2">
            <li>✓ Prompt for {money(sent.amount)} sent to {sent.phone}</li>
            <li className="font-semibold text-ink">… They confirm on their phone</li>
            <li>Then the receipt shows here</li>
          </ol>
          <Button variant="ghost" size="sm" onClick={onStop}>Stop waiting</Button>
        </>
      ) : (
        <p className="text-xl font-bold">Recording payment…</p>
      )}
    </section>
  );
}

function Receipt({ title, bookings }: { title: string; bookings: Booking[] }) {
  const { businessId } = useWork();
  const paid = bookings.reduce((sum, b) => sum + b.totalAmount.amount, 0);
  const tips = bookings.reduce((sum, b) => sum + (b.tip?.amount ?? 0), 0);
  const first = bookings[0];
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6">
      <section className="rounded-3xl bg-white p-8 ring-1 ring-ink/5 print:ring-0">
        <div className="flex flex-col items-center gap-2 text-center">
          <span className="grid size-14 place-items-center rounded-full bg-success/10 text-2xl text-success" aria-hidden>✓</span>
          <h1 className="text-2xl font-bold tracking-tight">Paid · {title}</h1>
          <p className="text-ink-2">
            {first?.paymentMethod ? PAYMENT_METHOD_LABEL[first.paymentMethod] : ''}
            {first?.paymentReference ? <> · <span className="font-mono">{first.paymentReference}</span></> : null}
          </p>
        </div>
        <ul className="mt-6 flex flex-col divide-y divide-line">
          {bookings.map((b) => (
            <li key={b.bookingId} className="flex items-center gap-3 py-3">
              {b.staffId ? <Avatar name={b.staffName} src={b.staffAvatarUrl} size={28} /> : null}
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{b.services.map((s) => s.name).join(', ')}</p>
                <p className="text-sm text-ink-2">
                  {b.staffName}{b.tip ? ` · tip ${money(b.tip)}` : ''}
                </p>
              </div>
              <span className="tabular-nums">{money(b.totalAmount)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-2 border-t border-line pt-3">
          <SummaryRow label="Services" value={money(paid)} />
          {tips ? <SummaryRow label="Tips (to the staff)" value={money(tips)} /> : null}
          <SummaryRow strong label="Total paid" value={money(paid + tips)} />
        </div>
      </section>
      <div className={cx('flex flex-wrap justify-center gap-2 print:hidden')}>
        <Button variant="secondary" onClick={() => window.print()}>Print receipt</Button>
        <Link href={workHref(businessId, 'today')} className="inline-flex"><Button>Back to today</Button></Link>
      </div>
    </div>
  );
}
