'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/field';
import { Card, PageHeader } from '@/components/ui/misc';
import { toast } from '@/components/ui/toast';
import { useLiveEvent } from '@/components/notifications/live';
import { useWork, workHref } from '@/components/work/context';
import { api, errorMessage, toQuery } from '@/lib/api';
import { money, timeLabel } from '@/lib/format';
import type { BookingStatus } from '@/types/booking';
import type { AmountCount, DaySummary } from '@/types/work-daily';
import { DateNav, InlineError, Loading, LoadError, StatusBadge, SummaryRow } from './bits';
import { replaceQuery, useBusinessClock } from './hooks';
import { STATUS_LABEL } from './status';
import { useApi, useBookingEvents } from './use-api';
import { useBusiness } from './use-business';

// End of day (F4): visits, the cash drawer (by method, and separately by
// kind: the same money split two ways, never summed), tips owed to staff,
// refunds paid back, visits still unpaid, and the front desk's submission
// to the owner.
export function DaySummaryView({ initialDate }: { initialDate?: string }) {
  const { businessId, role } = useWork();
  const { business } = useBusiness();
  const now = useBusinessClock(business?.timezone);
  const [date, setDateState] = useState(initialDate ?? now.date);
  const { data, error, reload, setData } = useApi<DaySummary>(`/businesses/${businessId}/day-summary${toQuery({ date })}`);
  useBookingEvents(reload);
  useLiveEvent((type) => type === 'day_summary_submitted', () => reload());

  const setDate = (d: string) => {
    setDateState(d);
    replaceQuery({ date: d === now.date ? null : d });
  };

  return (
    <div>
      <PageHeader
        title="Day summary"
        subtitle={role === 'front_desk' ? 'Check the drawer, then submit the day to the owner.' : 'What came in, what went out, and what is still open.'}
      />
      <div className="mb-6">
        <DateNav date={date} today={now.date} onChange={setDate} max={now.date} />
      </div>

      {error && !data ? (
        <LoadError error={error} onRetry={reload} title="Couldn't load the day summary" />
      ) : !data ? (
        <Loading />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="flex flex-col gap-6">
            <section aria-label="Visits" className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              <Tile label="Appointments" value={data.appointments} />
              <Tile label="Walk-ins" value={data.walkIns} />
              <Tile label="Completed" value={data.completed} />
              <Tile label="No-shows" value={data.noShows} tone={data.noShows ? 'danger' : undefined} />
              <Tile label="Cancelled" value={data.cancelled} />
            </section>

            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <h2 className="mb-2 font-bold">Collected</h2>
                <Line label="Cash" v={data.collected.cash} />
                <Line label="M-Pesa" v={data.collected.mpesa} />
                <div className="mt-1 border-t border-line pt-1">
                  <SummaryRow strong label="Total in" value={money(data.collected.cash.amount + data.collected.mpesa.amount)} />
                </div>
                {data.collected.tips && data.collected.tips.amount > 0 ? (
                  <div className="mt-3 rounded-xl bg-brand/5 px-3 py-2">
                    <Line label="Tips for staff" v={data.collected.tips} />
                    <p className="text-xs text-ink-2">Included above. Already in their wallets, so not the business&apos;s money.</p>
                  </div>
                ) : null}
              </Card>
              <Card>
                <h2 className="mb-2 font-bold">By kind</h2>
                <p className="mb-1 text-xs text-ink-3">The same money as Collected, split another way.</p>
                <Line label="Deposits" v={data.collected.depositsCollected} />
                <Line label="Balance payments" v={data.collected.balancePayments} />
                <div className="mt-3 border-t border-line pt-2">
                  <Line label="Refunds paid back" v={data.refundsPaid} />
                </div>
              </Card>
            </div>

            <Card>
              <h2 className="mb-2 font-bold">Not paid yet</h2>
              {data.unpaid.length === 0 ? (
                <p className="text-ink-2">Every visit that day is paid.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {data.unpaid.map((u) => (
                    <li key={u.bookingId}>
                      <Link
                        href={workHref(businessId, `appointments/${u.bookingId}`)}
                        className="-mx-2 flex items-center justify-between gap-3 rounded-lg px-2 py-2.5 hover:bg-surface-2"
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-semibold">{u.customerName}</span>
                          <span className="text-sm text-ink-2 tabular-nums">{timeLabel(u.time)}</span>
                        </span>
                        <span className="flex shrink-0 items-center gap-3">
                          {u.status && u.status in STATUS_LABEL ? <StatusBadge status={u.status as BookingStatus} /> : null}
                          <span className="font-semibold tabular-nums">{money(u.balanceDue)}</span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          <Submission key={`${date}-${data.submission.submittedAt}`} businessId={businessId} summary={data} canSubmit={date <= now.date} onSubmitted={(s) => setData(() => s)} />
        </div>
      )}
    </div>
  );
}

// Front desk submit the day (notes optional); resubmitting replaces the note.
function Submission({ businessId, summary, canSubmit, onSubmitted }: { businessId: string; summary: DaySummary; canSubmit: boolean; onSubmitted: (s: DaySummary) => void }) {
  const { role } = useWork();
  const [notes, setNotes] = useState(summary.submission.notes ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const sub = summary.submission;

  const submit = async () => {
    setSaving(true);
    setError('');
    try {
      const updated = await api<DaySummary>(`/businesses/${businessId}/day-summary/${summary.date}/submit`, {
        method: 'POST',
        body: { notes: notes.trim() || null },
      });
      onSubmitted(updated);
      toast.success(role === 'front_desk' ? 'Day submitted. The owner has been notified.' : 'Day marked as reconciled');
    } catch (err) {
      setError(errorMessage(err, "Couldn't submit the day."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="h-fit">
      <h2 className="mb-1 font-bold">{role === 'front_desk' ? 'Submit to the owner' : 'Submission'}</h2>
      {sub.submittedAt ? (
        <p className="mb-3 text-sm text-success">
          Submitted {new Date(sub.submittedAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
          {sub.submittedBy ? ` by ${sub.submittedBy}` : ''}
        </p>
      ) : (
        <p className="mb-3 text-sm text-ink-2">Not submitted yet.</p>
      )}
      {role === 'owner' && sub.notes ? <p className="mb-3 rounded-xl bg-surface-2 px-3 py-2 whitespace-pre-line">{sub.notes}</p> : null}
      <Textarea
        label={role === 'front_desk' ? 'Notes for the owner (optional)' : 'Notes (optional)'}
        placeholder="e.g. KSh 200 short due to change"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        maxLength={1000}
      />
      <div className="mt-3 flex flex-col gap-2">
        <InlineError>{error}</InlineError>
        <Button onClick={submit} loading={saving} disabled={!canSubmit}>
          {sub.submittedAt ? 'Submit again' : role === 'front_desk' ? 'Submit day' : 'Mark day reconciled'}
        </Button>
        {sub.submittedAt ? <p className="text-xs text-ink-3">Submitting again replaces the note.</p> : null}
      </div>
    </Card>
  );
}

function Tile({ label, value, tone }: { label: string; value: number; tone?: 'danger' }) {
  return (
    <div className="rounded-card border border-line bg-white px-4 py-3">
      <p className="text-xs font-semibold tracking-wide text-ink-3 uppercase">{label}</p>
      <p className={`text-2xl font-extrabold tabular-nums ${tone === 'danger' ? 'text-danger' : ''}`}>{value}</p>
    </div>
  );
}

function Line({ label, v }: { label: string; v: AmountCount }) {
  return (
    <SummaryRow
      label={
        <>
          {label} <span className="text-sm text-ink-3">· {v.count}</span>
        </>
      }
      value={money(v.amount)}
    />
  );
}
