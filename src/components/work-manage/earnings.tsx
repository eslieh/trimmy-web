'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/field';
import { Card, EmptyState, PageHeader, Tabs } from '@/components/ui/misc';
import { useWork } from '@/components/work/context';
import { toQuery } from '@/lib/api';
import { addDays, cx, dateKey, dayLabel, money, timeLabel } from '@/lib/format';
import type { TeamInvitation } from '@/types/team';
import type { EarningsBucket, EarningsSummary } from '@/types/work-manage';
import { ErrorBlock, Loading, METHOD_LABEL, SectionTitle, Stat, Table, td, th } from './shared';
import { useApi } from './use-api';

type Range = 'today' | 'week' | 'month' | 'year' | 'custom';

const RANGES: { key: Range; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: '7 days' },
  { key: 'month', label: '30 days' },
  { key: 'year', label: '12 months' },
  { key: 'custom', label: 'Custom' },
];

const PAGE = 25;

// Same windows as the mobile app (utils/earnings.ts): rolling, ending today.
function presetRange(range: Exclude<Range, 'custom'>, today: string): { from: string; to: string } {
  if (range === 'today') return { from: today, to: today };
  if (range === 'week') return { from: addDays(today, -6), to: today };
  if (range === 'month') return { from: addDays(today, -29), to: today };
  const [y, m] = today.split('-').map(Number);
  return { from: dateKey(new Date(y, m - 1 - 11, 1)), to: today };
}

function daysBetween(from: string, to: string): number {
  const [a, b] = [from, to].map((k) => {
    const [y, m, d] = k.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  });
  return Math.round((b - a) / 86400000);
}

export function EarningsDashboard({ initialStaffId }: { initialStaffId?: string }) {
  const { businessId, staffId: myStaffId } = useWork();
  const today = dateKey();
  const [range, setRange] = useState<Range>('week');
  const [custom, setCustom] = useState({ from: addDays(today, -13), to: today });
  const [staffId, setStaffId] = useState(initialStaffId ?? '');
  const [showAll, setShowAll] = useState(false);

  const span = range === 'custom' ? custom : presetRange(range, today);
  const customError =
    range === 'custom'
      ? !custom.from || !custom.to
        ? 'Pick both dates.'
        : custom.to < custom.from
          ? 'The end date is before the start date.'
          : daysBetween(custom.from, custom.to) > 365
            ? 'Pick at most a year.'
            : null
      : null;

  const path = customError
    ? null
    : `/businesses/${businessId}/earnings${toQuery({ from: span.from, to: span.to, staffId, transactionsLimit: showAll ? undefined : PAGE })}`;
  const { data, error, loading, reload } = useApi<EarningsSummary>(path);
  const team = useApi<{ members: TeamInvitation[] }>(`/businesses/${businessId}/team/members`);

  const people = useMemo(() => {
    const list = (team.data?.members ?? [])
      .filter((m) => m.status === 'accepted' && m.staffId)
      .map((m) => ({ staffId: m.staffId as string, name: m.name || m.email || m.phone || 'Team member' }));
    // An owner who takes clients has their own staff record too.
    if (myStaffId && !list.some((p) => p.staffId === myStaffId)) list.unshift({ staffId: myStaffId, name: 'Me' });
    return list;
  }, [team.data, myStaffId]);

  const scopedName = staffId ? people.find((p) => p.staffId === staffId)?.name ?? 'One person' : null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Earnings"
        subtitle={scopedName ? `${scopedName}'s paid work` : 'Paid bookings count on the day they were paid.'}
        actions={
          <Select
            aria-label="Whose earnings"
            value={staffId}
            onChange={(e) => {
              setStaffId(e.target.value);
              setShowAll(false);
            }}
            className="min-w-48"
          >
            <option value="">Whole business</option>
            {people.map((p) => (
              <option key={p.staffId} value={p.staffId}>
                {p.name}
              </option>
            ))}
          </Select>
        }
      />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <Tabs
          value={range}
          onChange={(r) => {
            setRange(r);
            setShowAll(false);
          }}
          options={RANGES}
        />
        {range === 'custom' ? (
          <div className="flex flex-wrap items-start gap-3">
            <Input type="date" label="From" value={custom.from} max={today} onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))} />
            <Input
              type="date"
              label="To"
              value={custom.to}
              max={today}
              onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))}
              error={customError ?? undefined}
            />
          </div>
        ) : (
          <p className="text-sm text-ink-2">
            {span.from === span.to ? dayLabel(span.from) : `${dayLabel(span.from)} – ${dayLabel(span.to)}`}
          </p>
        )}
      </div>

      {error && !data ? (
        <ErrorBlock message={error} onRetry={reload} />
      ) : !data ? (
        customError ? null : <Loading label="Loading earnings…" />
      ) : (
        <div className={cx('flex flex-col gap-6 transition-opacity', loading && 'opacity-60')} aria-busy={loading}>
          {error ? <ErrorBlock message={error} onRetry={reload} /> : null}
          <Hero data={data} scoped={!!staffId} />
          <div className="grid gap-6 xl:grid-cols-3">
            <Card className="xl:col-span-2">
              <SectionTitle title="Revenue trend" subtitle={`By ${data.granularity === 'hour' ? '3 hours' : data.granularity}`} />
              <TrendChart buckets={data.buckets} />
            </Card>
            <Card>
              <SectionTitle title="Payment methods" />
              <MethodSplit data={data} />
            </Card>
          </div>
          <div className="grid gap-6 xl:grid-cols-3">
            <Card className="xl:col-span-2">
              <SectionTitle title="Services" subtitle="Paid revenue by service" />
              <ServicesTable data={data} />
            </Card>
            <Card>
              <SectionTitle title="Money" subtitle="Deposits, fees, tips and refunds for bookings in this range" />
              <MoneyPanel data={data} />
            </Card>
          </div>
          {!staffId ? (
            <Card>
              <SectionTitle title="By team member" subtitle="Revenue they brought in and the commission it earned them" />
              <StaffTable data={data} onPick={(id) => setStaffId(id)} />
            </Card>
          ) : null}
          <Card>
            <SectionTitle
              title="Transactions"
              subtitle={`${data.transactionsTotal} paid ${data.transactionsTotal === 1 ? 'service' : 'services'}, newest first`}
            />
            <Transactions data={data} />
            {!showAll && data.transactionsTotal > data.transactions.length ? (
              <div className="mt-4 flex justify-center">
                <Button variant="secondary" size="sm" onClick={() => setShowAll(true)} loading={loading}>
                  Show all {data.transactionsTotal}
                </Button>
              </div>
            ) : null}
          </Card>
        </div>
      )}
    </div>
  );
}

function Hero({ data, scoped }: { data: EarningsSummary; scoped: boolean }) {
  const change = data.previous?.revenueChangePercent;
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
      <div className="col-span-2 rounded-card bg-ink p-5 text-white shadow-card lg:col-span-1">
        <p className="text-[13px] font-semibold text-white/70">Revenue</p>
        <p className="mt-1 text-3xl font-extrabold tracking-tight tabular-nums">{money(data.totalRevenue, data.currency)}</p>
        <p className="mt-1 text-[13px] text-white/70">
          {change === null || change === undefined ? (
            'Nothing to compare with before'
          ) : (
            <>
              <span className={change >= 0 ? 'text-emerald-300' : 'text-rose-300'}>
                {change >= 0 ? '▲' : '▼'} {Math.abs(change)}%
              </span>{' '}
              vs previous period
            </>
          )}
        </p>
      </div>
      <Stat label="Completed" value={data.completed} hint={`${data.paidBookings} paid ${data.paidBookings === 1 ? 'booking' : 'bookings'}`} />
      <Stat label="Average ticket" value={money(data.avgTicket, data.currency)} />
      <Stat label="No-shows / cancelled" value={`${data.noShow} / ${data.cancelled}`} tone={data.noShow + data.cancelled > 0 ? 'warning' : undefined} />
      <Stat label={scoped ? 'Their commission' : 'Team commission'} value={money(data.commission, data.currency)} hint="Owed to staff wallets" />
    </div>
  );
}

function TrendChart({ buckets }: { buckets: EarningsBucket[] }) {
  const max = Math.max(0, ...buckets.map((b) => b.amount));
  if (!buckets.length || max === 0) {
    return <p className="py-12 text-center text-ink-2">No paid bookings in this range yet.</p>;
  }
  // Round the axis up to a tidy number so gridlines read well.
  const step = 10 ** Math.floor(Math.log10(max));
  const top = Math.ceil(max / step) * step;
  const dense = buckets.length > 12;
  return (
    <figure>
      <div className="flex h-60 gap-2 sm:gap-3">
        <div className="flex flex-col justify-between pb-6 text-right text-[11px] text-ink-3 tabular-nums" aria-hidden>
          <span>{compact(top)}</span>
          <span>{compact(top / 2)}</span>
          <span>0</span>
        </div>
        <ol className="relative flex flex-1 items-end gap-1 sm:gap-2" aria-label="Revenue per period">
          <span className="pointer-events-none absolute inset-x-0 top-0 border-t border-dashed border-line" aria-hidden />
          <span className="pointer-events-none absolute inset-x-0 top-[calc(50%-12px)] border-t border-dashed border-line" aria-hidden />
          {buckets.map((b, i) => (
            <li key={`${b.start}-${i}`} className="group flex h-full min-w-0 flex-1 flex-col items-center justify-end">
              <div
                tabIndex={0}
                role="img"
                aria-label={`${b.label}: ${money(b.amount)}, ${b.bookingsCount} paid`}
                className="relative flex w-full max-w-12 flex-1 items-end outline-none"
              >
                <div
                  className="w-full rounded-t-md bg-brand/80 transition-colors group-hover:bg-brand group-focus-within:bg-brand"
                  style={{ height: `${(b.amount / top) * 100}%`, minHeight: b.amount > 0 ? 3 : 0 }}
                />
                <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-ink px-2 py-1 text-xs font-semibold text-white group-hover:block group-focus-within:block">
                  {money(b.amount)} · {b.bookingsCount}
                </span>
              </div>
              <span className={cx('mt-2 h-4 truncate text-[11px] text-ink-2', dense && i % 2 === 1 && 'invisible sm:visible')}>{b.label}</span>
            </li>
          ))}
        </ol>
      </div>
    </figure>
  );
}

function compact(n: number): string {
  if (n >= 1_000_000) return `${+(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${+(n / 1000).toFixed(1)}k`;
  return String(Math.round(n));
}

function MethodSplit({ data }: { data: EarningsSummary }) {
  const total = data.paymentMethods.reduce((s, m) => s + m.amount, 0);
  if (!total) return <p className="py-8 text-center text-ink-2">No payments yet.</p>;
  const colors: Record<string, string> = { mpesa: 'bg-brand', cash: 'bg-brand-pink' };
  return (
    <div className="flex flex-col gap-5">
      <div className="flex h-3 overflow-hidden rounded-full bg-surface-3" aria-hidden>
        {data.paymentMethods.map((m) => (
          <div key={m.method} className={colors[m.method] ?? 'bg-ink-3'} style={{ width: `${(m.amount / total) * 100}%` }} />
        ))}
      </div>
      <ul className="flex flex-col gap-3">
        {data.paymentMethods.map((m) => (
          <li key={m.method} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2">
              <span className={cx('size-2.5 rounded-full', colors[m.method] ?? 'bg-ink-3')} aria-hidden />
              <span className="font-semibold">{METHOD_LABEL[m.method] ?? m.method}</span>
              <span className="text-sm text-ink-2">{m.count} paid</span>
            </span>
            <span className="text-right tabular-nums">
              <span className="font-semibold">{money(m.amount)}</span>
              <span className="ml-2 text-sm text-ink-2">{Math.round((m.amount / total) * 100)}%</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ServicesTable({ data }: { data: EarningsSummary }) {
  const rows = [...data.services].sort((a, b) => b.amount - a.amount);
  if (!rows.length) return <p className="py-8 text-center text-ink-2">No services yet.</p>;
  const max = Math.max(1, ...rows.map((r) => r.amount));
  return (
    <Table
      head={
        <tr>
          <th className={th}>Service</th>
          <th className={cx(th, 'text-right')}>Paid</th>
          <th className={cx(th, 'w-2/5')}>Revenue</th>
        </tr>
      }
    >
      {rows.map((r, i) => (
        <tr key={r.serviceId ?? `deleted-${i}`} className={r.amount === 0 ? 'text-ink-3' : undefined}>
          <td className={td}>
            {r.name}
            {r.serviceId === null ? <span className="ml-2 text-xs text-ink-3">(deleted)</span> : null}
          </td>
          <td className={cx(td, 'text-right tabular-nums')}>{r.bookingsCount}</td>
          <td className={td}>
            <div className="flex items-center gap-3">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-3" aria-hidden>
                <div className="h-full rounded-full bg-brand/70" style={{ width: `${(r.amount / max) * 100}%` }} />
              </div>
              <span className="w-24 text-right font-semibold tabular-nums">{money(r.amount)}</span>
            </div>
          </td>
        </tr>
      ))}
    </Table>
  );
}

function MoneyPanel({ data }: { data: EarningsSummary }) {
  const m = data.money;
  const rows: { label: string; value: number; note?: string; tone?: 'danger' | 'success' }[] = [
    { label: 'Deposits collected', value: m.depositsCollected },
    { label: 'Tips', value: m.tips, note: 'Passed on to staff, not revenue' },
    { label: 'Cancellation fees', value: m.cancellationFees, note: 'Kept from late cancellations' },
    { label: 'No-show fees', value: m.noShowFees, note: 'Kept from deposits' },
    { label: 'Refunds due', value: m.refundsDue, note: 'You still owe these back', tone: m.refundsDue > 0 ? 'danger' : undefined },
    { label: 'Refunds paid', value: m.refundsPaid },
  ];
  const collected = m.collected.reduce((s, c) => s + c.amount, 0);
  return (
    <div className="flex flex-col gap-4">
      <dl className="divide-y divide-line">
        {rows.map((r) => (
          <div key={r.label} className="flex items-start justify-between gap-3 py-2.5">
            <dt>
              <span className="font-semibold">{r.label}</span>
              {r.note ? <span className="block text-xs text-ink-2">{r.note}</span> : null}
            </dt>
            <dd className={cx('font-semibold tabular-nums', r.tone === 'danger' && 'text-danger')}>{money(r.value)}</dd>
          </div>
        ))}
      </dl>
      {m.collected.length ? (
        <div className="rounded-xl bg-surface-2 p-3 text-sm">
          <p className="flex justify-between font-semibold">
            <span>All money in</span>
            <span className="tabular-nums">{money(collected)}</span>
          </p>
          <ul className="mt-1 flex flex-col gap-0.5 text-ink-2">
            {m.collected.map((c) => (
              <li key={`${c.method}-${c.kind}`} className="flex justify-between">
                <span>
                  {METHOD_LABEL[c.method] ?? c.method} {c.kind === 'deposit' ? 'deposits' : 'charges'} · {c.count}
                </span>
                <span className="tabular-nums">{money(c.amount)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function StaffTable({ data, onPick }: { data: EarningsSummary; onPick: (staffId: string) => void }) {
  if (!data.staff.length) return <p className="py-8 text-center text-ink-2">No paid bookings by anyone yet.</p>;
  return (
    <Table
      head={
        <tr>
          <th className={th}>Name</th>
          <th className={cx(th, 'text-right')}>Paid bookings</th>
          <th className={cx(th, 'text-right')}>Revenue</th>
          <th className={cx(th, 'text-right')}>Commission</th>
        </tr>
      }
    >
      {data.staff.map((s, i) => (
        <tr key={s.staffId ?? `none-${i}`}>
          <td className={td}>
            {s.staffId ? (
              <button className="font-semibold hover:underline" onClick={() => onPick(s.staffId as string)}>
                {s.name}
              </button>
            ) : (
              <span className="text-ink-2">{s.name || 'Unassigned'}</span>
            )}
          </td>
          <td className={cx(td, 'text-right tabular-nums')}>{s.bookingsCount}</td>
          <td className={cx(td, 'text-right font-semibold tabular-nums')}>{money(s.amount)}</td>
          <td className={cx(td, 'text-right tabular-nums')}>{money(s.commission)}</td>
        </tr>
      ))}
    </Table>
  );
}

function Transactions({ data }: { data: EarningsSummary }) {
  if (!data.transactions.length) {
    return <EmptyState title="No transactions" body="Paid bookings in this range show up here." />;
  }
  return (
    <Table
      head={
        <tr>
          <th className={th}>Paid</th>
          <th className={th}>Customer</th>
          <th className={th}>Service</th>
          <th className={th}>Method</th>
          <th className={cx(th, 'text-right')}>Amount</th>
        </tr>
      }
    >
      {data.transactions.map((t, i) => (
        <tr key={`${t.bookingId}-${t.serviceId ?? i}-${i}`}>
          <td className={cx(td, 'whitespace-nowrap text-ink-2')}>
            {dayLabel(t.date, { day: 'numeric', month: 'short' })} · {timeLabel(t.time)}
          </td>
          <td className={cx(td, 'font-semibold')}>{t.customerName}</td>
          <td className={td}>{t.serviceName}</td>
          <td className={td}>{t.paymentMethod ? METHOD_LABEL[t.paymentMethod] : '–'}</td>
          <td className={cx(td, 'text-right font-semibold tabular-nums')}>{money(t.amount)}</td>
        </tr>
      ))}
    </Table>
  );
}
