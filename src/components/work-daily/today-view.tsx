'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { EmptyState, PageHeader } from '@/components/ui/misc';
import { useWork, workHref } from '@/components/work/context';
import { toQuery } from '@/lib/api';
import { cx, dayLabel, timeLabel } from '@/lib/format';
import type { Booking } from '@/types/booking';
import type { AppointmentPreset, BookingsPage, TimeOff } from '@/types/work-daily';
import { AppointmentPanel } from './appointment-panel';
import { BookingRow, DateNav, Loading, LoadError, Segmented } from './bits';
import { BookingModal } from './booking-modal';
import { DayGrid, type BlockedTime, type GridColumn } from './day-grid';
import { replaceQuery, useBusinessClock, useInterval, useMedia } from './hooks';
import { isActive } from './status';
import { TimeOffModal } from './time-off-modal';
import { weekdayOf } from './time';
import { useApi, useBookingEvents } from './use-api';
import { useBusiness } from './use-business';

type View = 'grid' | 'list';
type ListTab = 'upcoming' | 'completed' | 'other';

// Today: the day grid (staff × time) with the appointment in a side panel,
// or a compact list on small screens. Walk-in and New appointment up top;
// click an empty slot to book that person then, a name for their time off.
export function TodayView({ initialDate, initialView }: { initialDate?: string; initialView?: View }) {
  const router = useRouter();
  const { businessId } = useWork();
  const { business, error: businessError, reload: reloadBusiness } = useBusiness();
  const now = useBusinessClock(business?.timezone);
  const wide = useMedia('(min-width: 1024px)');
  const tablet = useMedia('(min-width: 768px)');

  const [date, setDateState] = useState(initialDate ?? now.date);
  const [viewChoice, setViewChoice] = useState<View | null>(initialView ?? null);
  const view: View = viewChoice ?? (tablet ? 'grid' : 'list');
  const [tab, setTab] = useState<ListTab>('upcoming');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<{ mode: 'scheduled' | 'walk_in'; preset?: AppointmentPreset } | null>(null);
  const [timeOffFor, setTimeOffFor] = useState<{ staffId: string; name: string } | null>(null);

  const setDate = (d: string) => {
    setDateState(d);
    setSelectedId(null);
    replaceQuery({ date: d === now.date ? null : d });
  };
  const setView = (v: View) => {
    setViewChoice(v);
    replaceQuery({ view: v });
  };

  const bookings = useApi<BookingsPage>(`/businesses/${businessId}/bookings${toQuery({ date })}`);
  const timeOff = useApi<{ timeOff: TimeOff[] }>(`/businesses/${businessId}/time-off${toQuery({ from: date, to: date })}`);
  const { reload: reloadBookings } = bookings;
  const { reload: reloadTimeOff } = timeOff;
  const reloadDay = useCallback(() => {
    reloadBookings();
    reloadTimeOff();
  }, [reloadBookings, reloadTimeOff]);
  useBookingEvents(reloadDay);
  useInterval(reloadDay, 60_000);

  const all = useMemo(() => bookings.data?.bookings ?? [], [bookings.data]);
  const active = useMemo(() => all.filter(isActive), [all]);

  const blocked = useMemo<BlockedTime[]>(
    () =>
      (timeOff.data?.timeOff ?? []).map((t) => ({
        staffId: t.staffId,
        // A block from an earlier day runs from midnight; one ending later runs to midnight.
        start: t.date < date || t.allDay ? '00:00' : t.start,
        end: t.until > date || t.allDay ? '24:00' : t.end,
        label: t.reason || 'Time off',
      })),
    [timeOff.data, date],
  );

  const columns = useMemo<GridColumn[]>(() => {
    const cols: GridColumn[] = (business?.staff ?? []).filter((m) => m.bookable).map((m) => ({ staffId: m.staffId, name: m.name, avatarUrl: m.avatarUrl }));
    // Bookings with someone not in the list (e.g. removed since) still need a column.
    for (const b of active) {
      if (b.staffId && !cols.some((c) => c.staffId === b.staffId)) cols.push({ staffId: b.staffId, name: b.staffName });
    }
    if (cols.length !== 1 || active.some((b) => !b.staffId)) cols.push({ staffId: null, name: 'Any available' });
    return cols;
  }, [business, active]);

  const openBooking = (b: Booking) => {
    if (wide) setSelectedId(b.bookingId);
    else router.push(workHref(businessId, `appointments/${b.bookingId}`));
  };

  const patchBooking = (updated: Booking) => {
    bookings.setData((d) => ({ bookings: d.bookings.map((b) => (b.bookingId === updated.bookingId ? updated : b)) }));
  };

  const onCreated = (b: Booking) => {
    setForm(null);
    if (b.date !== date) setDate(b.date);
    else bookings.reload();
    if (wide) setSelectedId(b.bookingId);
    else router.push(workHref(businessId, `appointments/${b.bookingId}`));
  };

  const isToday = date === now.date;
  const hours = business?.workingHours[weekdayOf(date)] ?? null;
  const unassigned = active.filter((b) => !b.staffId && b.status !== 'completed').length;
  const inChair = active.filter((b) => b.status === 'in_progress').length;
  const refundsDue = all.filter((b) => b.refund?.status === 'due').length;

  const listed = useMemo(() => {
    const groups: Record<ListTab, Booking[]> = { upcoming: [], completed: [], other: [] };
    for (const b of all) {
      if (b.status === 'completed') groups.completed.push(b);
      else if (b.status === 'cancelled' || b.status === 'no_show') groups.other.push(b);
      else groups.upcoming.push(b);
    }
    return groups;
  }, [all]);

  const loadingDay = !bookings.data && !bookings.error;

  return (
    <div>
      <PageHeader
        title={isToday ? 'Today' : dayLabel(date, { weekday: 'long', day: 'numeric', month: 'long' })}
        subtitle={
          isToday
            ? dayLabel(date, { weekday: 'long', day: 'numeric', month: 'long' })
            : hours
              ? `Open ${timeLabel(hours.open)} – ${timeLabel(hours.close)}`
              : 'Closed'
        }
        actions={
          <>
            <Button variant="secondary" onClick={() => setForm({ mode: 'walk_in' })} disabled={!business}>
              Walk-in
            </Button>
            <Button onClick={() => setForm({ mode: 'scheduled', preset: { date: date >= now.date ? date : now.date } })} disabled={!business}>
              New appointment
            </Button>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <DateNav date={date} today={now.date} onChange={setDate} />
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-ink-2" aria-live="polite">
            {bookings.data ? (
              <>
                <span className="font-semibold text-ink">{active.length}</span> booked
                {inChair ? <> · {inChair} in progress</> : null}
                {unassigned ? <> · <span className="font-semibold text-warning">{unassigned} unassigned</span></> : null}
                {refundsDue ? <> · <span className="font-semibold text-danger">{refundsDue} refund{refundsDue > 1 ? 's' : ''} owed</span></> : null}
              </>
            ) : null}
          </p>
          <Segmented label="View" value={view} onChange={setView} options={[{ key: 'grid', label: 'Grid' }, { key: 'list', label: 'List' }]} />
        </div>
      </div>

      {businessError && !business ? (
        <LoadError error={businessError} onRetry={reloadBusiness} title="Couldn't load the business" />
      ) : bookings.error && !bookings.data ? (
        <LoadError error={bookings.error} onRetry={bookings.reload} title="Couldn't load the day" />
      ) : !business || loadingDay ? (
        <Loading label="Loading the day…" />
      ) : (
        <div className="flex gap-4">
          <div className="min-w-0 flex-1">
            {view === 'grid' ? (
              columns.length === 0 ? (
                <EmptyState title="No one to schedule yet" body="Staff appear here once the owner has added them and their services." />
              ) : (
                <DayGrid
                  columns={columns}
                  bookings={active}
                  blocked={blocked}
                  openTime={hours?.open ?? null}
                  closeTime={hours?.close ?? null}
                  nowMinutes={isToday ? now.minutes : null}
                  selectedId={selectedId}
                  onOpenBooking={openBooking}
                  onPickSlot={(staffId, time) => setForm({ mode: 'scheduled', preset: { date, time, staffId: staffId ?? undefined } })}
                  onPickStaff={(c) => c.staffId && setTimeOffFor({ staffId: c.staffId, name: c.name })}
                />
              )
            ) : (
              <div className="flex flex-col gap-3">
                <Segmented
                  label="Show"
                  value={tab}
                  onChange={setTab}
                  options={[
                    { key: 'upcoming', label: `Upcoming · ${listed.upcoming.length}` },
                    { key: 'completed', label: `Completed · ${listed.completed.length}` },
                    { key: 'other', label: `No-show & cancelled · ${listed.other.length}` },
                  ]}
                />
                {listed[tab].length === 0 ? (
                  <EmptyState
                    title={tab === 'upcoming' ? 'Nothing coming up' : tab === 'completed' ? 'Nothing completed yet' : 'None'}
                    body={tab === 'upcoming' ? 'New bookings and walk-ins show up here.' : undefined}
                  />
                ) : (
                  <div className="divide-y divide-line overflow-hidden rounded-card border border-line bg-white">
                    {listed[tab].map((b) => (
                      <BookingRow key={b.bookingId} booking={b} onOpen={openBooking} active={b.bookingId === selectedId} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {wide && selectedId ? (
            <aside
              aria-label="Appointment"
              className={cx('sticky top-20 hidden h-[calc(100dvh-7rem)] w-[400px] shrink-0 overflow-hidden rounded-card border border-line bg-white shadow-card lg:block')}
            >
              <AppointmentPanel key={selectedId} bookingId={selectedId} variant="panel" onClose={() => setSelectedId(null)} onChanged={patchBooking} />
            </aside>
          ) : null}
        </div>
      )}

      <BookingModal mode={form?.mode ?? null} business={business} preset={form?.preset} today={now.date} onClose={() => setForm(null)} onDone={onCreated} />
      {timeOffFor ? (
        <TimeOffModal
          key={`${timeOffFor.staffId}-${date}`}
          businessId={businessId}
          staff={timeOffFor}
          date={date >= now.date ? date : now.date}
          today={now.date}
          onClose={() => setTimeOffFor(null)}
          onChanged={timeOff.reload}
        />
      ) : null}
    </div>
  );
}
