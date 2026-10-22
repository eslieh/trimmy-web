'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ApiError, api, errorMessage } from '@/lib/api';
import { Button, Spinner } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/field';
import { Avatar } from '@/components/ui/misc';
import { toast } from '@/components/ui/toast';
import { cx, dayLabel, money, timeLabel } from '@/lib/format';
import type { Booking } from '@/types/booking';
import type { BusinessProfile, BusinessProfileService } from '@/types/discovery';
import type { StartPaymentResult } from '@/types/customer-web';
import { CheckIcon, ChevronLeftIcon, PhoneIcon, StarIcon } from '../icons';
import { useCart, useNow } from '../hooks';
import { depositFailureMessage, minutesLabel } from '../labels';
import { Photo } from '../photo';
import { SlotPicker, isComplete, type SlotChoice } from './slot-picker';

type Step = 'services' | 'staff' | 'time' | 'review' | 'pay' | 'pending';
type Outcome = 'lateRefund' | 'expired' | 'stillWaiting' | null;

const STEPS: { key: Step; label: string }[] = [
  { key: 'services', label: 'Services' },
  { key: 'staff', label: 'Professional' },
  { key: 'time', label: 'Time' },
  { key: 'review', label: 'Review' },
];

const TITLES: Record<Step, string> = {
  services: 'Choose services',
  staff: 'Choose a professional',
  time: 'Pick a date & time',
  review: 'Review & confirm',
  pay: 'Pay your deposit',
  pending: 'Check your phone',
};

const POLL_MS = 3000;
const POLL_LIMIT_MS = 2 * 60 * 1000;

// An estimate of the deposit, the way the server prices it (booking/pricing.py):
// percent of the covered total rounded up, or the fixed amount capped at it.
// The booking the server returns has the real figure.
function estimateDeposit(profile: BusinessProfile, chosen: BusinessProfileService[]): number | null {
  const rule = profile.policies.deposit;
  if (!rule.required) return null;
  const covered = rule.appliesTo === 'selected_services' ? chosen.filter((s) => rule.serviceIds.includes(s.serviceId)) : chosen;
  const base = covered.reduce((sum, s) => sum + s.price.amount, 0);
  if (base <= 0) return null;
  const amount = rule.type === 'percent' ? Math.ceil((base * (rule.percent ?? 0)) / 100) : Math.min(rule.amount?.amount ?? 0, base);
  return amount || null;
}

// The booking flow (mobile C2): services → professional → date & time →
// review & policies → create → (deposit) M-Pesa prompt → wait → confirmed.
// `resume` is a pending_payment booking reopened from ?booking=.
export function BookingFlow({
  profile, userPhone, resume, preferredStaffId = null,
}: { profile: BusinessProfile; userPhone: string | null; resume: Booking | null; preferredStaffId?: string | null }) {
  const router = useRouter();
  const businessId = profile.businessId;
  const { ids, toggle, set: setCartIds } = useCart(businessId);
  const chosen = profile.services.filter((s) => ids.includes(s.serviceId));
  const serviceIds = chosen.map((s) => s.serviceId);

  const [stepState, setStep] = useState<Step | null>(resume ? (resume.depositPayment?.status === 'pending' ? 'pending' : 'pay') : null);
  // Until they move, start on Professional if services were picked on the profile.
  const step: Step = stepState ?? (chosen.length ? 'staff' : 'services');
  const [pickedStaffId, setStaffId] = useState<string | null>(resume?.staffId ?? preferredStaffId);
  const [choice, setChoice] = useState<SlotChoice | null>(null);
  const [slotsVersion, setSlotsVersion] = useState(0);
  const [notes, setNotes] = useState('');
  const [repricedTotal, setRepricedTotal] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [booking, setBooking] = useState<Booking | null>(resume);
  const [phone, setPhone] = useState(resume?.customerPhone ?? userPhone ?? '');
  const [paymentId, setPaymentId] = useState<string | null>(resume?.depositPayment?.paymentId ?? null);
  const [failure, setFailure] = useState<string | null>(
    resume?.depositPayment && ['failed', 'timeout'].includes(resume.depositPayment.status) ? resume.depositPayment.failureReason ?? resume.depositPayment.status : null,
  );
  const [sending, setSending] = useState(false);
  const [outcome, setOutcome] = useState<Outcome>(null);
  const [pollRound, setPollRound] = useState(0);

  const eligibleStaff = profile.staff.filter((s) => s.allServices || serviceIds.every((id) => s.serviceIds.includes(id)));
  // A professional picked on the profile only sticks while they do every chosen service.
  const staffId = resume || !pickedStaffId || eligibleStaff.some((s) => s.staffId === pickedStaffId) ? pickedStaffId : null;
  const staff = staffId ? profile.staff.find((s) => s.staffId === staffId) ?? null : null;
  const total = chosen.reduce((sum, s) => sum + s.price.amount, 0);
  const minutes = chosen.reduce((sum, s) => sum + s.durationMinutes, 0);
  const shownTotal = repricedTotal ?? total;
  const deposit = estimateDeposit(profile, chosen);

  const go = (next: Step) => {
    setError(null);
    setStep(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ?booking=<id> keeps a pending payment reachable after a reload.
  const setBookingInUrl = (id: string | null) => {
    window.history.replaceState(null, '', id ? `?booking=${id}` : window.location.pathname);
  };

  const finishConfirmed = (b: Booking) => {
    setCartIds([]);
    router.replace(`/b/${businessId}/book/confirmed?booking=${b.bookingId}`);
  };

  const startOver = () => {
    setBooking(null);
    setBookingInUrl(null);
    setOutcome(null);
    setFailure(null);
    setPaymentId(null);
    setChoice(null);
    setSlotsVersion((v) => v + 1);
    // Reopened from a link, the cart may be empty: rebook the same services.
    const fromBooking = booking?.services.map((s) => s.serviceId).filter((id): id is string => !!id) ?? [];
    if (!chosen.length && fromBooking.length) setCartIds(fromBooking);
    go(chosen.length || fromBooking.length ? 'time' : 'services');
  };

  const create = async () => {
    if (!isComplete(choice)) return;
    setCreating(true);
    setError(null);
    try {
      // Only what was chosen: the server prices it. expectedTotal is what
      // they're looking at, so a price change can't slip through.
      const created = await api<Booking>('/bookings', {
        method: 'POST',
        body: {
          businessId,
          staffId,
          services: serviceIds.map((serviceId) => ({ serviceId, quantity: 1 })),
          date: choice.date,
          time: choice.time,
          notes: notes.trim() || undefined,
          expectedTotal: { amount: shownTotal, currency: 'KES' },
        },
      });
      if (created.status === 'pending_payment') {
        setBooking(created);
        setBookingInUrl(created.bookingId);
        go('pay');
      } else {
        finishConfirmed(created);
      }
    } catch (err) {
      if (err instanceof ApiError && err.code === 'slot_unavailable') {
        // Someone else got it: back to the times, freshly loaded.
        toast.error({ title: 'That time was just taken', body: 'Please pick another time.' });
        setChoice({ date: choice.date, time: null });
        setSlotsVersion((v) => v + 1);
        go('time');
      } else if (err instanceof ApiError && err.code === 'price_changed') {
        const amount = (err.body?.totalAmount as { amount?: number } | undefined)?.amount;
        if (typeof amount === 'number') setRepricedTotal(amount);
        setError(errorMessage(err, 'Prices have changed. Please review the new total.'));
      } else {
        setError(errorMessage(err, "Couldn't book this appointment. Please try again."));
      }
    } finally {
      setCreating(false);
    }
  };

  const sendPrompt = async () => {
    if (!booking) return;
    setSending(true);
    setFailure(null);
    setError(null);
    try {
      const res = await api<StartPaymentResult>(`/bookings/${booking.bookingId}/payments`, { method: 'POST', body: phone.trim() ? { phone: phone.trim() } : {} });
      setPaymentId(res.paymentId);
      setPollRound((n) => n + 1);
      go('pending');
    } catch (err) {
      const code = err instanceof ApiError ? err.code : '';
      if (code === 'payment_in_progress' || code === 'already_paid' || code === 'no_deposit_due') {
        // A prompt is already out, or it's settled: the polling finds out which.
        const existing = err instanceof ApiError ? err.body?.paymentId : null;
        setPaymentId(typeof existing === 'string' ? existing : null);
        setPollRound((n) => n + 1);
        go('pending');
      } else if (code === 'hold_expired') {
        setOutcome('expired');
      } else {
        setError(errorMessage(err, "Couldn't send the M-Pesa prompt. Please try again."));
      }
    } finally {
      setSending(false);
    }
  };

  // While the prompt is out: poll the booking every 3s for up to 2 minutes
  // (mobile StkPendingScreen, BK-31/32).
  const bookingId = booking?.bookingId;
  const polling = step === 'pending' && !outcome;
  useEffect(() => {
    if (!polling || !bookingId) return;
    let live = true;
    let timer: ReturnType<typeof setTimeout>;
    const started = Date.now();
    const poll = async () => {
      try {
        const b = await api<Booking>(`/bookings/${bookingId}`);
        if (!live) return;
        setBooking(b);
        if (b.status === 'confirmed' || b.status === 'in_progress' || b.status === 'completed') {
          live = false;
          setCartIds([]);
          router.replace(`/b/${businessId}/book/confirmed?booking=${b.bookingId}`);
          return;
        }
        if (b.status === 'cancelled') {
          // Paid after the hold ran out and the slot went: the business refunds it.
          setOutcome(b.paymentStatus === 'deposit_paid' ? 'lateRefund' : 'expired');
          return;
        }
        const p = b.depositPayment;
        if (p && (p.status === 'failed' || p.status === 'timeout') && (!paymentId || p.paymentId === paymentId)) {
          setFailure(p.failureReason ?? p.status);
          setStep('pay');
          return;
        }
      } catch {
        // A dropped request mid-poll isn't an outcome: keep trying.
      }
      if (!live) return;
      if (Date.now() - started >= POLL_LIMIT_MS) {
        setOutcome('stillWaiting');
        return;
      }
      timer = setTimeout(poll, POLL_MS);
    };
    timer = setTimeout(poll, POLL_MS);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [polling, bookingId, pollRound, paymentId, businessId, router, setCartIds]);

  // ─── Render ───────────────────────────────────────────────────────────

  if (outcome) {
    const content = {
      lateRefund: {
        title: 'Payment arrived too late',
        body: 'Your payment came in after the slot hold expired, and the time has since been taken. The business will refund your deposit.',
      },
      expired: { title: 'Your slot hold expired', body: "The deposit wasn't paid in time, so the slot was released. Pick a time again to book." },
      stillWaiting: { title: 'Still waiting for M-Pesa', body: "We haven't heard back about your payment yet. If you paid, check again in a moment." },
    }[outcome];
    return (
      <Shell profile={profile} onBack={null} title={content.title}>
        <p className="text-ink-2">{content.body}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          {outcome === 'stillWaiting' ? (
            <>
              <Button
                onClick={() => {
                  setOutcome(null);
                  setPollRound((n) => n + 1);
                }}
              >
                Check again
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setOutcome(null);
                  setFailure('timeout');
                  go('pay');
                }}
              >
                Send a new prompt
              </Button>
            </>
          ) : (
            <>
              <Button onClick={startOver}>Pick another time</Button>
              {booking ? (
                <Link href={`/bookings/${booking.bookingId}`} className="inline-flex h-11 items-center px-2 font-semibold underline">
                  View booking
                </Link>
              ) : null}
            </>
          )}
        </div>
      </Shell>
    );
  }

  if (step === 'pending') {
    return (
      <Shell profile={profile} onBack={null} title="Check your phone">
        <div className="flex flex-col items-center gap-4 py-8 text-center" aria-live="polite">
          <span className="grid size-16 place-items-center rounded-full bg-brand/10 text-brand">
            <PhoneIcon className="size-8" />
          </span>
          <p className="max-w-sm text-ink-2">
            We sent an M-Pesa prompt{phone ? ` to ${phone}` : ''}
            {booking?.depositAmount ? ` for ${money(booking.depositAmount)}` : ''}. Enter your M-Pesa PIN to confirm.
          </p>
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Spinner className="size-4 text-brand" /> Waiting for confirmation…
          </p>
          <p className="text-[13px] text-ink-3">Keep this page open. It updates by itself.</p>
        </div>
      </Shell>
    );
  }

  if (step === 'pay' && booking) {
    return (
      <PayStep
        profile={profile}
        booking={booking}
        phone={phone}
        setPhone={setPhone}
        failure={failure}
        error={error}
        sending={sending}
        onSend={sendPrompt}
        onExpired={() => setOutcome('expired')}
      />
    );
  }

  const index = STEPS.findIndex((s) => s.key === step);
  const back = index > 0 ? () => go(STEPS[index - 1].key) : null;

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-12">
      <div className="min-w-0">
        <div className="mb-6 flex items-center gap-3">
          {back ? (
            <button type="button" onClick={back} aria-label="Back" className="grid size-10 shrink-0 place-items-center rounded-full border border-line-2 hover:border-ink">
              <ChevronLeftIcon />
            </button>
          ) : (
            <Link href={`/b/${businessId}`} aria-label={`Back to ${profile.name}`} className="grid size-10 shrink-0 place-items-center rounded-full border border-line-2 hover:border-ink">
              <ChevronLeftIcon />
            </Link>
          )}
          <div className="min-w-0">
            <p className="text-sm text-ink-2">
              Step {index + 1} of {STEPS.length}
            </p>
            <h1 className="text-2xl font-extrabold tracking-tight">
              {TITLES[step]}
            </h1>
          </div>
        </div>
        <ol className="mb-8 grid grid-cols-4 gap-2" aria-label="Progress">
          {STEPS.map((s, i) => (
            <li key={s.key} aria-current={i === index ? 'step' : undefined}>
              <span className={cx('block h-1.5 rounded-full', i <= index ? 'bg-brand' : 'bg-line')} />
              <span className={cx('mt-1.5 hidden text-xs font-semibold sm:block', i === index ? 'text-ink' : 'text-ink-3')}>{s.label}</span>
            </li>
          ))}
        </ol>

        {step === 'services' ? (
          <ServicesStep services={profile.services} selected={ids} onToggle={toggle} />
        ) : step === 'staff' ? (
          <div role="radiogroup" aria-label="Professional" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <StaffOption selected={staffId === null} onSelect={() => { setStaffId(null); setChoice(null); }} title="Any available" subtitle="Most availability: the business assigns someone." />
            {eligibleStaff.map((s) => (
              <StaffOption
                key={s.staffId}
                selected={staffId === s.staffId}
                onSelect={() => {
                  setStaffId(s.staffId);
                  setChoice(null);
                }}
                title={s.name}
                subtitle={s.specialties.slice(0, 2).join(', ') || 'Professional'}
                rating={s.rating}
                avatar={<Avatar name={s.name} src={s.avatarUrl} size={44} />}
              />
            ))}
            {profile.staff.length > eligibleStaff.length ? (
              <p className="text-sm text-ink-2 sm:col-span-2">Only people who offer every service you chose are shown.</p>
            ) : null}
          </div>
        ) : step === 'time' ? (
          <SlotPicker businessId={businessId} serviceIds={serviceIds} staffId={staffId} value={choice} onChange={setChoice} version={slotsVersion} />
        ) : (
          <ReviewStep
            profile={profile}
            chosen={chosen}
            staffName={staff?.name ?? 'Any available'}
            choice={choice}
            minutes={minutes}
            total={shownTotal}
            deposit={deposit}
            notes={notes}
            setNotes={setNotes}
            onEdit={go}
          />
        )}

        <div className="sticky bottom-0 z-10 -mx-4 mt-8 border-t border-line bg-white/95 px-4 py-4 backdrop-blur sm:mx-0 sm:rounded-b-card sm:px-0 lg:static lg:border-0 lg:bg-transparent lg:p-0" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
          {error ? <p role="alert" className="mb-3 rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p> : null}
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0 lg:hidden">
              <p className="font-bold">{money(shownTotal)}</p>
              <p className="truncate text-sm text-ink-2">{chosen.length ? `${chosen.length} service${chosen.length > 1 ? 's' : ''} · ${minutesLabel(minutes)}` : 'No services yet'}</p>
            </div>
            {step === 'review' ? (
              <Button variant="brand" size="lg" className="ml-auto" loading={creating} disabled={!isComplete(choice) || !chosen.length} onClick={create}>
                {deposit ? 'Continue to payment' : 'Confirm booking'}
              </Button>
            ) : (
              <Button
                size="lg"
                className="ml-auto"
                disabled={step === 'services' ? !chosen.length : step === 'time' ? !isComplete(choice) : false}
                onClick={() => go(STEPS[index + 1].key)}
              >
                Continue
              </Button>
            )}
          </div>
        </div>
      </div>

      <aside className="hidden lg:block">
        <div className="sticky top-24 rounded-card border border-line p-5 shadow-card">
          <Summary profile={profile} chosen={chosen} staffName={staff?.name ?? 'Any available'} choice={choice} total={shownTotal} minutes={minutes} deposit={deposit} />
        </div>
      </aside>
    </div>
  );
}

function Shell({ profile, title, children, onBack }: { profile: BusinessProfile; title: string; children: React.ReactNode; onBack: (() => void) | null }) {
  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-6 flex items-center gap-3">
        {onBack ? (
          <button type="button" onClick={onBack} aria-label="Back" className="grid size-10 place-items-center rounded-full border border-line-2 hover:border-ink">
            <ChevronLeftIcon />
          </button>
        ) : null}
        <div>
          <p className="text-sm text-ink-2">{profile.name}</p>
          <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
        </div>
      </div>
      <div className="rounded-card border border-line p-6 shadow-card">{children}</div>
    </div>
  );
}

function ServicesStep({ services, selected, onToggle }: { services: BusinessProfileService[]; selected: string[]; onToggle: (id: string) => void }) {
  if (!services.length) return <p className="text-ink-2">This business hasn&apos;t listed any services yet.</p>;
  const groups = new Map<string, BusinessProfileService[]>();
  for (const s of services) groups.set(s.categoryName, [...(groups.get(s.categoryName) ?? []), s]);
  return (
    <div className="flex flex-col gap-6">
      {[...groups].map(([category, items]) => (
        <fieldset key={category}>
          <legend className="mb-2 text-sm font-bold uppercase tracking-wide text-ink-2">{category}</legend>
          <div className="flex flex-col gap-2">
            {items.map((s) => {
              const on = selected.includes(s.serviceId);
              return (
                <label key={s.serviceId} className={cx('flex cursor-pointer items-center gap-4 rounded-card border p-4 transition-colors', on ? 'border-ink bg-surface-2' : 'border-line-2 hover:border-ink')}>
                  <input type="checkbox" checked={on} onChange={() => onToggle(s.serviceId)} className="size-5 accent-[var(--color-ink)]" />
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{s.name}</span>
                    <span className="block text-sm text-ink-2">{minutesLabel(s.durationMinutes)}</span>
                  </span>
                  <span className="font-semibold">{money(s.price)}</span>
                </label>
              );
            })}
          </div>
        </fieldset>
      ))}
    </div>
  );
}

function StaffOption({
  selected, onSelect, title, subtitle, rating, avatar,
}: { selected: boolean; onSelect: () => void; title: string; subtitle: string; rating?: number; avatar?: React.ReactNode }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cx('flex items-center gap-3 rounded-card border p-4 text-left transition-colors', selected ? 'border-ink bg-surface-2 ring-1 ring-ink' : 'border-line-2 hover:border-ink')}
    >
      {avatar ?? <span className="grid size-11 shrink-0 place-items-center rounded-full bg-brand-gradient text-lg font-bold text-white" aria-hidden>✦</span>}
      <span className="min-w-0 flex-1">
        <span className="block font-bold">{title}</span>
        <span className="block text-sm capitalize text-ink-2">
          {subtitle}
          {rating ? (
            <span className="ml-2 inline-flex items-center gap-0.5 font-semibold text-ink">
              <StarIcon className="size-3" /> {rating.toFixed(1)}
            </span>
          ) : null}
        </span>
      </span>
      {selected ? <CheckIcon className="size-5 shrink-0" /> : null}
    </button>
  );
}

function ReviewStep({
  profile, chosen, staffName, choice, minutes, total, deposit, notes, setNotes, onEdit,
}: {
  profile: BusinessProfile;
  chosen: BusinessProfileService[];
  staffName: string;
  choice: SlotChoice | null;
  minutes: number;
  total: number;
  deposit: number | null;
  notes: string;
  setNotes: (v: string) => void;
  onEdit: (step: Step) => void;
}) {
  const { cancellation, noShow } = profile.policies;
  return (
    <div className="flex flex-col gap-4">
      <ReviewCard title="Services" onEdit={() => onEdit('services')}>
        <ul className="flex flex-col gap-1.5">
          {chosen.map((s) => (
            <li key={s.serviceId} className="flex justify-between gap-3">
              <span>{s.name}</span>
              <span className="font-semibold">{money(s.price)}</span>
            </li>
          ))}
        </ul>
        <p className="mt-1 text-sm text-ink-2">{minutesLabel(minutes)} in total</p>
      </ReviewCard>
      <ReviewCard title="Professional" onEdit={() => onEdit('staff')}>
        <p className="font-semibold">{staffName}</p>
      </ReviewCard>
      <ReviewCard title="Date & time" onEdit={() => onEdit('time')}>
        <p className="font-semibold">{isComplete(choice) ? `${dayLabel(choice.date, { weekday: 'long', day: 'numeric', month: 'long' })} at ${timeLabel(choice.time)}` : 'Not chosen yet'}</p>
      </ReviewCard>
      <div className="rounded-card border border-line p-5">
        <div className="flex justify-between gap-3 text-lg">
          <span className="font-bold">Total</span>
          <span className="font-bold">{money(total)}</span>
        </div>
        {deposit ? (
          <div className="mt-2 flex justify-between gap-3">
            <span className="text-ink-2">Deposit to pay now with M-Pesa</span>
            <span className="font-bold text-brand">{money(deposit)}</span>
          </div>
        ) : (
          <p className="mt-1 text-sm text-ink-2">No deposit needed. Pay at the business.</p>
        )}
        {deposit ? <p className="mt-1 text-sm text-ink-2">The rest ({money(Math.max(total - deposit, 0))}) is paid at the business. The deposit goes straight to {profile.name}.</p> : null}
      </div>
      <Textarea label="Notes for the business (optional)" placeholder="e.g. Short on the sides" maxLength={500} value={notes} onChange={(e) => setNotes(e.target.value)} />
      <div className="rounded-card bg-surface-2 p-5 text-[15px]">
        <p className="mb-2 font-bold">Before you book</p>
        <ul className="flex list-disc flex-col gap-1.5 pl-5 text-ink-2">
          <li>
            {cancellation.freeCancellationHours > 0
              ? `Free cancellation up to ${cancellation.freeCancellationHours} hours before your appointment.`
              : 'Cancelling has no free window.'}
            {cancellation.lateFeePercent > 0 ? ` After that, ${cancellation.lateFeePercent}% of the total may be kept from your deposit.` : ''}
          </li>
          <li>{noShow.feePercent > 0 ? `If you don't show up, the business may charge ${noShow.feePercent}% of the total.` : 'No fee for missed appointments.'}</li>
          {deposit ? <li>Your slot is held for a few minutes while you pay the deposit.</li> : null}
        </ul>
      </div>
    </div>
  );
}

function ReviewCard({ title, onEdit, children }: { title: string; onEdit: () => void; children: React.ReactNode }) {
  return (
    <div className="rounded-card border border-line p-5">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-bold uppercase tracking-wide text-ink-2">{title}</h2>
        <button type="button" onClick={onEdit} className="text-sm font-semibold underline">
          Edit
        </button>
      </div>
      {children}
    </div>
  );
}

function Summary({
  profile, chosen, staffName, choice, total, minutes, deposit,
}: { profile: BusinessProfile; chosen: BusinessProfileService[]; staffName: string; choice: SlotChoice | null; total: number; minutes: number; deposit: number | null }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <div className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-surface-3">
          <Photo src={profile.photos[0]} alt="" name={profile.name} sizes="64px" />
        </div>
        <div className="min-w-0">
          <p className="truncate font-bold">{profile.name}</p>
          <p className="truncate text-sm text-ink-2">{profile.address}</p>
        </div>
      </div>
      <div className="border-t border-line pt-4 text-[15px]">
        {chosen.length ? (
          <ul className="flex flex-col gap-1.5">
            {chosen.map((s) => (
              <li key={s.serviceId} className="flex justify-between gap-3">
                <span>{s.name}</span>
                <span>{money(s.price)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-ink-2">No services chosen yet.</p>
        )}
        <p className="mt-3 text-ink-2">With {staffName}</p>
        {isComplete(choice) ? <p className="text-ink-2">{`${dayLabel(choice.date)} · ${timeLabel(choice.time)}`}</p> : null}
        {minutes ? <p className="text-ink-2">{minutesLabel(minutes)}</p> : null}
      </div>
      <div className="border-t border-line pt-4">
        <div className="flex justify-between font-bold">
          <span>Total</span>
          <span>{money(total)}</span>
        </div>
        {deposit ? (
          <div className="mt-1 flex justify-between text-sm">
            <span className="text-ink-2">Deposit due now</span>
            <span className="font-semibold">{money(deposit)}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function PayStep({
  profile, booking, phone, setPhone, failure, error, sending, onSend, onExpired,
}: {
  profile: BusinessProfile;
  booking: Booking;
  phone: string;
  setPhone: (v: string) => void;
  failure: string | null;
  error: string | null;
  sending: boolean;
  onSend: () => void;
  onExpired: () => void;
}) {
  const now = useNow(true);
  const expiresAt = booking.expiresAt ? new Date(booking.expiresAt).getTime() : null;
  const secondsLeft = expiresAt && now ? Math.max(0, Math.round((expiresAt - now) / 1000)) : null;
  const expired = secondsLeft === 0;
  const countdown = secondsLeft !== null ? `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, '0')}` : null;

  return (
    <Shell profile={profile} onBack={null} title="Pay your deposit">
      <div className="flex flex-col gap-5">
        <div className="rounded-xl bg-surface-2 p-4">
          <div className="flex justify-between gap-3">
            <span className="text-ink-2">Deposit</span>
            <span className="text-lg font-bold">{booking.depositAmount ? money(booking.depositAmount) : ''}</span>
          </div>
          <p className="mt-1 text-sm text-ink-2">
            {dayLabel(booking.date, { weekday: 'long', day: 'numeric', month: 'long' })} at {timeLabel(booking.time)} · {booking.services.map((s) => s.name).join(', ')}
          </p>
          <p className="mt-1 text-sm text-ink-2">Booking total {money(booking.totalAmount)}. The rest is paid at the business.</p>
        </div>

        {countdown ? (
          <p className={cx('text-sm font-semibold', expired ? 'text-danger' : 'text-warning')} aria-live="polite">
            {expired ? 'Your slot hold has expired.' : `We're holding this slot for you for ${countdown}.`}
          </p>
        ) : null}
        {failure ? <p role="alert" className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">{depositFailureMessage(failure)} You can try again.</p> : null}

        {expired ? (
          <Button onClick={onExpired}>Pick another time</Button>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onSend();
            }}
            className="flex flex-col gap-4"
          >
            <Input
              label="M-Pesa phone number"
              type="tel"
              autoComplete="tel"
              placeholder="0712 345 678"
              hint="We'll send an M-Pesa prompt to this phone. Enter your PIN there to pay."
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            {error ? <p role="alert" className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p> : null}
            <Button type="submit" variant="brand" size="lg" loading={sending} disabled={phone.replace(/\D/g, '').length < 9}>
              {failure ? 'Send a new prompt' : 'Send M-Pesa prompt'}
            </Button>
          </form>
        )}
        <p className="text-[13px] text-ink-3">
          Changed your mind? <Link href={`/bookings/${booking.bookingId}`} className="underline">Open the booking</Link> to cancel it.
        </p>
      </div>
    </Shell>
  );
}
