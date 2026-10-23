'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Avatar, Card, EmptyState } from '@/components/ui/misc';
import { useWork, workHref } from '@/components/work/context';
import { ApiError, toQuery } from '@/lib/api';
import { money } from '@/lib/format';
import type { Booking } from '@/types/booking';
import type { BookingsPage, CustomersPage } from '@/types/work-daily';
import { BookingRow, Loading, LoadError } from './bits';
import { BookingModal } from './booking-modal';
import { useBusinessClock } from './hooks';
import { formatPhone } from './phone';
import { instantDate } from './time';
import { useApi, useBookingEvents } from './use-api';
import { useBusiness } from './use-business';
import { ReportButton } from '@/components/customer/report-button';

// One customer: contact, their visit history here (list-business-bookings
// ?customerId=, newest first, every source) and a pre-filled New appointment.
export function CustomerDetail({ customerId }: { customerId: string }) {
  const router = useRouter();
  const { businessId } = useWork();
  const { business } = useBusiness();
  const now = useBusinessClock(business?.timezone);
  const [booking, setBooking] = useState(false);

  const history = useApi<BookingsPage>(`/businesses/${businessId}/bookings${toQuery({ customerId, limit: 200 })}`);
  useBookingEvents(history.reload);
  const visits = useMemo(() => history.data?.bookings ?? [], [history.data]);

  // There's no "get one customer" endpoint: find the record in the list,
  // searched by the contact on their latest booking (or the first page A–Z).
  const latest = visits[0];
  const lookup = latest ? (latest.customerPhone?.replace(/\D/g, '') || latest.customerEmail || latest.customerName) : '';
  const listPath = history.data ? `/businesses/${businessId}/customers${toQuery({ query: lookup || undefined, limit: lookup ? 20 : 500 })}` : null;
  const list = useApi<CustomersPage>(listPath);
  const record = list.data?.customers.find((c) => c.customerId === customerId) ?? null;

  const name = record?.name ?? latest?.customerName ?? '';
  const phone = record?.phone ?? latest?.customerPhone ?? null;
  const email = record?.email ?? latest?.customerEmail ?? null;
  const onTrimmy = visits.some((b) => b.customerHasAccount);

  const stats = useMemo(() => {
    const done = visits.filter((b) => b.status === 'completed');
    return {
      completed: done.length,
      noShows: visits.filter((b) => b.status === 'no_show').length,
      spent: done.reduce((sum, b) => sum + (b.paymentStatus === 'paid' ? b.totalAmount.amount : 0), 0),
      upcoming: visits.filter((b) => ['pending_payment', 'confirmed'].includes(b.status) && b.date >= now.date).length,
    };
  }, [visits, now.date]);

  const back = (
    <Link href={workHref(businessId, 'customers')} className="mb-4 inline-block rounded-full px-3 py-1.5 text-sm font-semibold text-ink-2 hover:bg-surface-2 hover:text-ink">
      ← Customers
    </Link>
  );

  if (history.error && !history.data) {
    const missing = history.error instanceof ApiError && history.error.status === 404;
    return (
      <div>
        {back}
        {missing ? <EmptyState title="Customer not found" body="They may have been removed from your list." /> : <LoadError error={history.error} onRetry={history.reload} />}
      </div>
    );
  }
  if (!history.data || (!latest && !list.data && !list.error)) {
    return (
      <div>
        {back}
        <Loading />
      </div>
    );
  }

  const open = (b: Booking) => router.push(workHref(businessId, `appointments/${b.bookingId}`));

  return (
    <div>
      {back}
      <div className="grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
        <div className="flex flex-col gap-4">
          <Card>
            <div className="flex items-center gap-4">
              <Avatar name={name || '?'} src={record?.avatarUrl ?? latest?.customerAvatarUrl} size={56} />
              <div className="min-w-0">
                <h1 className="truncate text-2xl font-extrabold tracking-tight">{name || 'Customer'}</h1>
                {onTrimmy ? <p className="text-sm font-semibold text-brand">On Trimmy</p> : null}
              </div>
            </div>
            <dl className="mt-5 flex flex-col gap-3 text-[15px]">
              <div>
                <dt className="text-xs font-semibold tracking-wide text-ink-3 uppercase">Phone</dt>
                <dd>{phone ? <a href={`tel:${phone}`} className="hover:underline">{formatPhone(phone)}</a> : <span className="text-ink-3">—</span>}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold tracking-wide text-ink-3 uppercase">Email</dt>
                <dd className="truncate">{email ? <a href={`mailto:${email}`} className="hover:underline">{email}</a> : <span className="text-ink-3">—</span>}</dd>
              </div>
              {record ? (
                <div>
                  <dt className="text-xs font-semibold tracking-wide text-ink-3 uppercase">In your list since</dt>
                  <dd>{instantDate(record.createdAt, business?.timezone)}</dd>
                </div>
              ) : null}
            </dl>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button onClick={() => setBooking(true)} disabled={!business}>
                New appointment
              </Button>
              {phone ? (
                <a href={`tel:${phone}`} className="inline-flex h-11 items-center rounded-full border border-line-2 px-5 text-[15px] font-semibold hover:border-ink">
                  Call
                </a>
              ) : null}
            </div>
          </Card>
          <Card className="grid grid-cols-2 gap-4">
            <Stat label="Visits" value={String(stats.completed)} />
            <Stat label="Upcoming" value={String(stats.upcoming)} />
            <Stat label="No-shows" value={String(stats.noShows)} />
            <Stat label="Paid" value={money(stats.spent)} />
          </Card>
        </div>

        <section aria-labelledby="history-title">
          <h2 id="history-title" className="mb-3 text-lg font-bold">
            History
          </h2>
          {visits.length === 0 ? (
            <EmptyState title="No visits yet" body="Bookings with their phone or email show up here." />
          ) : (
            <div className="divide-y divide-line overflow-hidden rounded-card border border-line bg-white">
              {visits.map((b) => (
                <BookingRow key={b.bookingId} booking={b} onOpen={open} showDate />
              ))}
            </div>
          )}
        </section>
      </div>
      <ReportButton targetType="customer" targetId={customerId} name={name} label="Report this customer to Trimmy" className="self-center" />

      <BookingModal
        mode={booking ? 'scheduled' : null}
        business={business}
        preset={{ customerName: name, customerPhone: phone ?? undefined, customerEmail: email ?? undefined, date: now.date }}
        today={now.date}
        onClose={() => setBooking(false)}
        onDone={(b) => {
          setBooking(false);
          history.reload();
          open(b);
        }}
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold tracking-wide text-ink-3 uppercase">{label}</p>
      <p className="text-lg font-bold tabular-nums">{value}</p>
    </div>
  );
}
