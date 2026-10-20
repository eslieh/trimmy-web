'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { EmptyState, PageHeader, Tabs } from '@/components/ui/misc';
import { useWork, workHref } from '@/components/work/context';
import { toQuery } from '@/lib/api';
import { addDays, cx, dayLabel, money, timeLabel } from '@/lib/format';
import type { Booking, BookingStatus } from '@/types/booking';
import type { BookingsPage } from '@/types/work-daily';
import { BookingRow, Loading, LoadError, StatusBadge } from './bits';
import { replaceQuery, useBusinessClock } from './hooks';
import { formatPhone } from './phone';
import { ALL_STATUSES, PAYMENT_METHOD_LABEL, STATUS_LABEL, servicesLabel } from './status';
import { daysBetween } from './time';
import { useApi, useBookingEvents } from './use-api';
import { useBusiness } from './use-business';

type Tab = 'all' | 'unassigned' | 'refunds';
const MAX_RANGE = 62; // the API's limit for from..to

// Bookings: search and filter any range (list-business-bookings), plus the
// two queues the desk works through: unassigned ("Any available") bookings
// and refunds owed.
export function BookingsView({ initialTab }: { initialTab: Tab }) {
  const router = useRouter();
  const { businessId } = useWork();
  const { business } = useBusiness();
  const now = useBusinessClock(business?.timezone);
  const [tab, setTabState] = useState<Tab>(initialTab);
  const [from, setFrom] = useState(now.date);
  const [to, setTo] = useState(addDays(now.date, 13));
  const [status, setStatus] = useState<BookingStatus | 'active' | ''>('');
  const [staffId, setStaffId] = useState('');
  const [search, setSearch] = useState('');

  const setTab = (t: Tab) => {
    setTabState(t);
    replaceQuery({ tab: t === 'all' ? null : t });
  };

  const rangeError = to < from ? 'The end date must be on or after the start.' : daysBetween(from, to) > MAX_RANGE ? `Pick at most ${MAX_RANGE} days.` : '';
  const statusParam = status === 'active' ? 'pending_payment,confirmed,in_progress' : status || undefined;
  const path =
    tab === 'refunds'
      ? `/businesses/${businessId}/bookings${toQuery({ refund: 'due' })}`
      : rangeError
        ? null
        : `/businesses/${businessId}/bookings${toQuery({
            from,
            to,
            status: statusParam,
            staffId: tab === 'all' ? staffId || undefined : undefined,
            unassigned: tab === 'unassigned' ? 'true' : undefined,
          })}`;
  const { data, error, loading, reload } = useApi<BookingsPage>(path);
  useBookingEvents(reload);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const digits = q.replace(/\D/g, '').replace(/^0/, '');
    const list = data?.bookings ?? [];
    if (!q) return list;
    return list.filter(
      (b) =>
        b.customerName.toLowerCase().includes(q) ||
        (b.customerEmail ?? '').toLowerCase().includes(q) ||
        (b.reference ?? '').toLowerCase().includes(q) ||
        b.services.some((s) => s.name.toLowerCase().includes(q)) ||
        (digits.length >= 3 && (b.customerPhone ?? '').includes(digits)),
    );
  }, [data, search]);

  const open = (b: Booking) => router.push(workHref(businessId, `appointments/${b.bookingId}`));

  return (
    <div>
      <PageHeader title="Bookings" subtitle="Search any range, and work through the unassigned and refund queues." />

      <div className="mb-4">
        <Tabs
          value={tab}
          onChange={setTab}
          options={[
            { key: 'all', label: 'All' },
            { key: 'unassigned', label: 'Unassigned' },
            { key: 'refunds', label: 'Refunds owed' },
          ]}
        />
      </div>

      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-card border border-line bg-white p-4">
        <label className="flex min-w-[200px] flex-1 flex-col text-sm font-semibold">
          <span className="mb-1.5">Search</span>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Name, phone, email, reference, service"
            className="h-10 rounded-xl border border-line-2 px-3 text-[15px] font-normal outline-none focus:border-ink"
          />
        </label>
        {tab !== 'refunds' ? (
          <>
            <Field label="From">
              <input type="date" value={from} onChange={(e) => e.target.value && setFrom(e.target.value)} className={inputClass} />
            </Field>
            <Field label="To">
              <input type="date" value={to} min={from} onChange={(e) => e.target.value && setTo(e.target.value)} className={inputClass} />
            </Field>
            <Field label="Status">
              <select value={status} onChange={(e) => setStatus(e.target.value as BookingStatus | 'active' | '')} className={inputClass}>
                <option value="">Any status</option>
                <option value="active">Upcoming &amp; in progress</option>
                {ALL_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABEL[s]}
                  </option>
                ))}
              </select>
            </Field>
            {tab === 'all' ? (
              <Field label="Staff">
                <select value={staffId} onChange={(e) => setStaffId(e.target.value)} className={inputClass}>
                  <option value="">Everyone</option>
                  {(business?.staff ?? []).map((m) => (
                    <option key={m.staffId} value={m.staffId}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </Field>
            ) : null}
          </>
        ) : null}
      </div>

      {rangeError ? (
        <p role="alert" className="mb-4 text-sm text-danger">
          {rangeError}
        </p>
      ) : null}

      {error && !data ? (
        <LoadError error={error} onRetry={reload} title="Couldn't load bookings" />
      ) : !data ? (
        rangeError ? null : <Loading />
      ) : rows.length === 0 ? (
        <EmptyState
          title={tab === 'refunds' ? 'No refunds owed' : tab === 'unassigned' ? 'Everything is assigned' : 'No bookings found'}
          body={tab === 'refunds' ? 'Refunds you owe customers (e.g. after a business cancellation) show up here.' : search ? 'Try another search.' : 'Try another date range or filter.'}
        />
      ) : (
        <>
          <p className="mb-2 text-sm text-ink-2" aria-live="polite">
            {rows.length} booking{rows.length === 1 ? '' : 's'}
            {loading ? ' · refreshing…' : ''}
          </p>
          {/* Phones: compact rows. */}
          <div className="divide-y divide-line overflow-hidden rounded-card border border-line bg-white md:hidden">
            {rows.map((b) => (
              <BookingRow key={b.bookingId} booking={b} onOpen={open} showDate />
            ))}
          </div>
          {/* Desktop: a proper table. */}
          <div className="hidden overflow-x-auto rounded-card border border-line bg-white md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line bg-surface-2 text-xs tracking-wide text-ink-2 uppercase">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold">When</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Customer</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Services</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Staff</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Status</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">Total</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Payment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((b) => (
                  <tr
                    key={b.bookingId}
                    tabIndex={0}
                    onClick={() => open(b)}
                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), open(b))}
                    className="cursor-pointer align-top transition-colors hover:bg-surface-2 focus-visible:bg-surface-2"
                  >
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="block font-semibold">{dayLabel(b.date)}</span>
                      <span className="text-ink-2 tabular-nums">{timeLabel(b.time)}</span>
                    </td>
                    <td className="max-w-[220px] px-4 py-3">
                      <span className="block truncate font-semibold">{b.customerName}</span>
                      <span className="block truncate text-ink-2">{formatPhone(b.customerPhone) || b.customerEmail || '—'}</span>
                    </td>
                    <td className="max-w-[260px] px-4 py-3">
                      <span className="line-clamp-2">{servicesLabel(b)}</span>
                      {b.reference ? <span className="font-mono text-xs text-ink-3">{b.reference}</span> : null}
                    </td>
                    <td className={cx('px-4 py-3 whitespace-nowrap', !b.staffId && 'font-semibold text-warning')}>{b.staffId ? b.staffName : 'Unassigned'}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={b.status} />
                    </td>
                    <td className="px-4 py-3 text-right font-semibold whitespace-nowrap tabular-nums">{money(b.totalAmount)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {b.refund?.status === 'due' ? (
                        <span className="font-semibold text-danger">Refund {money(b.refund.amount)} owed</span>
                      ) : b.paymentStatus === 'paid' ? (
                        <span className="text-success">Paid{b.paymentMethod ? ` · ${PAYMENT_METHOD_LABEL[b.paymentMethod]}` : ''}</span>
                      ) : b.paymentStatus === 'deposit_paid' ? (
                        <span className="text-ink-2">Deposit paid</span>
                      ) : (
                        <span className="text-ink-3">Unpaid</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

const inputClass = 'h-10 rounded-xl border border-line-2 bg-white px-3 text-[15px] font-normal outline-none focus:border-ink';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col text-sm font-semibold">
      <span className="mb-1.5">{label}</span>
      {children}
    </label>
  );
}
