'use client';

import Link from 'next/link';
import { useState } from 'react';
import { api, errorMessage, toQuery } from '@/lib/api';
import { Button, ButtonLink, Spinner } from '@/components/ui/button';
import { Badge, EmptyState, Tabs } from '@/components/ui/misc';
import { dayLabel, money, timeLabel } from '@/lib/format';
import type { Booking } from '@/types/booking';
import type { MyBookingsFilter, MyBookingsPage } from '@/types/customer-web';
import { useLoad } from '../hooks';
import { ChevronRightIcon } from '../icons';
import { STATUS_LABEL, STATUS_TONE } from '../labels';

const TABS: { key: MyBookingsFilter; label: string }[] = [
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'past', label: 'Past' },
  { key: 'cancelled', label: 'Cancelled' },
];

const EMPTY: Record<MyBookingsFilter, { title: string; body: string }> = {
  upcoming: { title: 'No upcoming appointments', body: 'When you book, your appointments show up here.' },
  past: { title: 'No past appointments yet', body: 'Completed visits show up here, ready for a review.' },
  cancelled: { title: 'Nothing cancelled', body: 'Cancelled and expired bookings show up here.' },
};

const PAGE = 20;

// GET /me/bookings?filter=, 20 at a time with the server's cursor.
export function BookingsList({ initialTab }: { initialTab: MyBookingsFilter }) {
  const [tab, setTab] = useState<MyBookingsFilter>(initialTab);
  const first = useLoad(`my-bookings:${tab}`, () => api<MyBookingsPage>(`/me/bookings${toQuery({ filter: tab, limit: PAGE })}`), "Couldn't load your bookings.");
  // Later pages, for the tab they were loaded on.
  const [more, setMore] = useState<{ tab: MyBookingsFilter; bookings: Booking[]; cursor: string | null } | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState<string | null>(null);

  const extra = more?.tab === tab ? more : null;
  const bookings = first.data ? [...first.data.bookings, ...(extra?.bookings ?? [])] : [];
  const cursor = extra ? extra.cursor : (first.data?.nextCursor ?? null);

  const switchTab = (next: MyBookingsFilter) => {
    setTab(next);
    setMore(null);
    setMoreError(null);
    // Keep the tab in the URL (back button, reloads) without a server round trip.
    window.history.replaceState(null, '', next === 'upcoming' ? '/bookings' : `/bookings?tab=${next}`);
  };

  const loadMore = async () => {
    if (!cursor) return;
    setLoadingMore(true);
    setMoreError(null);
    try {
      const page = await api<MyBookingsPage>(`/me/bookings${toQuery({ filter: tab, limit: PAGE, cursor })}`);
      setMore({ tab, bookings: [...(extra?.bookings ?? []), ...page.bookings], cursor: page.nextCursor });
    } catch (err) {
      setMoreError(errorMessage(err, "Couldn't load more bookings."));
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <Tabs value={tab} onChange={switchTab} options={TABS} />
      {first.error ? (
        <EmptyState title="Couldn't load your bookings" body={first.error} action={<Button variant="secondary" onClick={first.reload}>Try again</Button>} />
      ) : !first.data ? (
        <div className="grid h-48 place-items-center text-ink-2">
          <Spinner />
        </div>
      ) : bookings.length === 0 ? (
        <EmptyState title={EMPTY[tab].title} body={EMPTY[tab].body} action={tab === 'upcoming' ? <ButtonLink href="/">Find a place to book</ButtonLink> : null} />
      ) : (
        <>
          <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {bookings.map((b) => (
              <li key={b.bookingId}>
                <BookingRow booking={b} />
              </li>
            ))}
          </ul>
          {moreError ? <p role="alert" className="text-center text-sm text-danger">{moreError}</p> : null}
          {cursor ? (
            <div className="flex justify-center">
              <Button variant="secondary" onClick={loadMore} loading={loadingMore}>
                Show more
              </Button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

function BookingRow({ booking: b }: { booking: Booking }) {
  return (
    <Link href={`/bookings/${b.bookingId}`} className="group flex items-center gap-4 rounded-card border border-line bg-white p-4 transition-shadow hover:shadow-card">
      <div className="flex w-14 shrink-0 flex-col items-center rounded-xl bg-surface-2 py-2">
        <span className="text-xs font-semibold uppercase text-ink-2">{dayLabel(b.date, { month: 'short' })}</span>
        <span className="text-xl font-extrabold leading-tight">{dayLabel(b.date, { day: 'numeric' })}</span>
        <span className="text-[11px] text-ink-2">{dayLabel(b.date, { weekday: 'short' })}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate font-bold">{b.businessName}</p>
          <Badge tone={STATUS_TONE[b.status]}>{STATUS_LABEL[b.status]}</Badge>
        </div>
        <p className="truncate text-sm text-ink-2">
          {timeLabel(b.time)} · {b.services.map((s) => s.name).join(', ')}
        </p>
        <p className="truncate text-sm text-ink-2">
          {b.staffName} · {money(b.totalAmount)}
          {b.status === 'pending_payment' ? <span className="font-semibold text-warning"> · Deposit to pay</span> : null}
          {b.status === 'completed' && !b.review ? <span className="font-semibold text-brand"> · Leave a review</span> : null}
        </p>
      </div>
      <ChevronRightIcon className="size-5 shrink-0 text-ink-3 group-hover:text-ink" />
    </Link>
  );
}
