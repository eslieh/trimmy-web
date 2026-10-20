'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { EmptyState, PageHeader } from '@/components/ui/misc';
import { useWork, workHref } from '@/components/work/context';
import { toQuery } from '@/lib/api';
import { cx, dayLabel, timeLabel } from '@/lib/format';
import type { Booking } from '@/types/booking';
import type { AppointmentPreset, BookingsPage } from '@/types/work-daily';
import { BookingRow, Chevron, IconButton, Loading, LoadError } from './bits';
import { BookingModal } from './booking-modal';
import { replaceQuery, useBusinessClock } from './hooks';
import { isActive } from './status';
import { addMonths, monthEnd, monthStart, toMinutes, toTime, weekdayOf } from './time';
import { useApi, useBookingEvents } from './use-api';
import { useBusiness } from './use-business';

const WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
// Browsing open times before any service is chosen: 30-minute starts. The
// real check (against the chosen services) happens in New appointment.
const BROWSE_MINUTES = 30;

// Calendar: a month with each day's booking count; pick a day to see its
// bookings and the times still open, and book one of them.
export function CalendarView({ initialDate }: { initialDate?: string }) {
  const router = useRouter();
  const { businessId } = useWork();
  const { business } = useBusiness();
  const now = useBusinessClock(business?.timezone);
  const [selected, setSelectedState] = useState(initialDate ?? now.date);
  const [month, setMonth] = useState(monthStart(initialDate ?? now.date));
  const [preset, setPreset] = useState<AppointmentPreset | null>(null);

  const setSelected = (d: string) => {
    setSelectedState(d);
    if (monthStart(d) !== month) setMonth(monthStart(d));
    replaceQuery({ date: d });
  };

  const { data, error, reload } = useApi<BookingsPage>(`/businesses/${businessId}/bookings${toQuery({ from: month, to: monthEnd(month) })}`);
  useBookingEvents(reload);

  const byDay = useMemo(() => {
    const map = new Map<string, Booking[]>();
    for (const b of data?.bookings ?? []) map.set(b.date, [...(map.get(b.date) ?? []), b]);
    return map;
  }, [data]);

  // Monday-first weeks covering the month.
  const cells = useMemo(() => {
    const [y, m] = month.split('-').map(Number);
    const first = new Date(y, m - 1, 1);
    const lead = (first.getDay() + 6) % 7;
    const days = new Date(y, m, 0).getDate();
    const list: (string | null)[] = Array.from({ length: lead }, () => null);
    for (let d = 1; d <= days; d++) list.push(`${month.slice(0, 7)}-${String(d).padStart(2, '0')}`);
    while (list.length % 7) list.push(null);
    return list;
  }, [month]);

  const dayBookings = useMemo(() => (byDay.get(selected) ?? []).slice().sort((a, b) => a.time.localeCompare(b.time)), [byDay, selected]);
  const hours = business?.workingHours[weekdayOf(selected)] ?? null;

  // Start times where fewer bookings overlap than there are people to take them.
  const openTimes = useMemo(() => {
    if (!business || !hours || selected < now.date) return [];
    const capacity = Math.max(1, business.staff.filter((m) => m.bookable).length);
    const active = dayBookings.filter(isActive);
    const list: string[] = [];
    for (let t = toMinutes(hours.open); t + BROWSE_MINUTES <= toMinutes(hours.close); t += BROWSE_MINUTES) {
      if (selected === now.date && t <= now.minutes) continue;
      const overlapping = active.filter((b) => toMinutes(b.time) < t + BROWSE_MINUTES && toMinutes(b.time) + b.durationMinutes > t).length;
      if (overlapping < capacity) list.push(toTime(t));
    }
    return list;
  }, [business, hours, selected, now, dayBookings]);

  const monthName = dayLabel(month, { month: 'long', year: 'numeric' });

  return (
    <div>
      <PageHeader
        title="Calendar"
        actions={
          <Button onClick={() => setPreset({ date: selected >= now.date ? selected : now.date })} disabled={!business}>
            New appointment
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <section aria-label={monthName} className="rounded-card border border-line bg-white p-4 sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold">{monthName}</h2>
            <div className="flex items-center gap-2">
              {month !== monthStart(now.date) ? (
                <Button variant="ghost" size="sm" onClick={() => setSelected(now.date)}>
                  Today
                </Button>
              ) : null}
              <IconButton label="Previous month" onClick={() => setMonth(addMonths(month, -1))}>
                <Chevron dir="left" />
              </IconButton>
              <IconButton label="Next month" onClick={() => setMonth(addMonths(month, 1))}>
                <Chevron dir="right" />
              </IconButton>
            </div>
          </div>

          {error && !data ? <LoadError error={error} onRetry={reload} title="Couldn't load the month" /> : null}

          <div role="grid" aria-label={`${monthName} bookings`} className="grid grid-cols-7 gap-1">
            {WEEK.map((d) => (
              <div key={d} role="columnheader" className="pb-1 text-center text-xs font-semibold text-ink-3">
                {d}
              </div>
            ))}
            {cells.map((key, i) => {
              if (!key) return <div key={`e${i}`} />;
              const list = (byDay.get(key) ?? []).filter(isActive);
              const closed = business ? !business.workingHours[weekdayOf(key)] : false;
              const isSel = key === selected;
              const isToday = key === now.date;
              return (
                <button
                  key={key}
                  type="button"
                  role="gridcell"
                  aria-selected={isSel}
                  aria-label={`${dayLabel(key, { weekday: 'long', day: 'numeric', month: 'long' })}: ${list.length} booking${list.length === 1 ? '' : 's'}${closed ? ', closed' : ''}`}
                  onClick={() => setSelected(key)}
                  className={cx(
                    'flex aspect-square min-h-12 flex-col items-center justify-start gap-1 rounded-xl p-1.5 text-sm transition-colors sm:aspect-auto sm:h-20 sm:items-start sm:p-2',
                    isSel ? 'bg-ink text-white' : closed ? 'bg-surface-2 text-ink-3 hover:bg-surface-3' : 'hover:bg-surface-2',
                    key < now.date && !isSel && 'text-ink-3',
                  )}
                >
                  <span className={cx('grid size-7 place-items-center rounded-full font-semibold', isToday && !isSel && 'bg-brand text-white')}>{Number(key.slice(8))}</span>
                  {list.length ? (
                    <span className="flex items-center gap-1">
                      <span className="flex gap-0.5" aria-hidden>
                        {list.slice(0, 3).map((b) => (
                          <span key={b.bookingId} className={cx('size-1.5 rounded-full', isSel ? 'bg-white' : 'bg-brand')} />
                        ))}
                      </span>
                      <span className={cx('hidden text-xs font-semibold sm:inline', isSel ? 'text-white' : 'text-ink-2')}>{list.length}</span>
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
          {!data && !error ? <Loading className="py-4" /> : null}
        </section>

        <section aria-label="Selected day" className="flex flex-col gap-4">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold">{dayLabel(selected, { weekday: 'long', day: 'numeric', month: 'long' })}</h2>
              <p className="text-sm text-ink-2">{hours ? `Open ${timeLabel(hours.open)} – ${timeLabel(hours.close)}` : 'Closed'}</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => router.push(`${workHref(businessId, 'today')}${toQuery({ date: selected })}`)}>
              Day grid →
            </Button>
          </div>

          {dayBookings.length ? (
            <div className="divide-y divide-line overflow-hidden rounded-card border border-line bg-white">
              {dayBookings.map((b) => (
                <BookingRow key={b.bookingId} booking={b} onOpen={() => router.push(workHref(businessId, `appointments/${b.bookingId}`))} />
              ))}
            </div>
          ) : data ? (
            <EmptyState title="No bookings" body={hours ? 'Nothing booked yet this day.' : undefined} />
          ) : null}

          {openTimes.length ? (
            <div>
              <h3 className="mb-2 text-sm font-semibold text-ink-2">Open times</h3>
              <div className="flex flex-wrap gap-2">
                {openTimes.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setPreset({ date: selected, time: t })}
                    className="h-9 rounded-full border border-line-2 bg-white px-3 text-sm font-semibold tabular-nums hover:border-ink"
                  >
                    {timeLabel(t)}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      </div>

      <BookingModal
        mode={preset ? 'scheduled' : null}
        business={business}
        preset={preset ?? undefined}
        today={now.date}
        onClose={() => setPreset(null)}
        onDone={(b) => {
          setPreset(null);
          reload();
          router.push(workHref(businessId, `appointments/${b.bookingId}`));
        }}
      />
    </div>
  );
}
