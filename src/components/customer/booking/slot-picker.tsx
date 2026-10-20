'use client';

import { useState } from 'react';
import { api, toQuery } from '@/lib/api';
import { Spinner } from '@/components/ui/button';
import { addDays, cx, dayLabel, timeLabel } from '@/lib/format';
import type { AvailabilityDays, AvailabilityForDay } from '@/types/customer-web';
import { useLoad } from '../hooks';
import { ChevronLeftIcon, ChevronRightIcon } from '../icons';
import { minutesLabel } from '../labels';

const WINDOW = 14;

export type SlotChoice = { date: string; time: string | null };

// Days and start times from the server (availability/days and availability),
// which knows working hours, staff schedules, booking settings and existing
// bookings. Times are business-local and shown as-is. `version` reloads the
// times (e.g. after a slot was taken meanwhile).
export function SlotPicker({
  businessId, serviceIds, staffId, value, onChange, version = 0,
}: {
  businessId: string;
  serviceIds: string[];
  staffId: string | null;
  value: SlotChoice | null;
  onChange: (choice: SlotChoice | null) => void;
  version?: number;
}) {
  // Each 14-day window starts where the previous one ended; null = today.
  const [windows, setWindows] = useState<(string | null)[]>([null]);
  const from = windows[windows.length - 1];
  const base = `${businessId}|${serviceIds.join(',')}|${staffId ?? 'any'}`;

  const days = useLoad(serviceIds.length ? `days|${base}|${from}` : null, () =>
    api<AvailabilityDays>(`/businesses/${businessId}/availability/days${toQuery({ serviceIds, staffId, from, days: WINDOW })}`),
    "Couldn't load available days.",
  );
  const dayList = days.data?.days ?? [];
  const inWindow = value && dayList.some((d) => d.date === value.date) ? value.date : null;
  const selectedDate = inWindow ?? dayList.find((d) => d.hasSlots)?.date ?? null;

  const slots = useLoad(selectedDate ? `slots|${base}|${selectedDate}|${version}` : null, () =>
    api<AvailabilityForDay>(`/businesses/${businessId}/availability${toQuery({ serviceIds, staffId, date: selectedDate })}`),
    "Couldn't load times for this day.",
  );
  const selectedTime = value && value.date === selectedDate && slots.data?.slots.some((s) => s.time === value.time) ? value.time : null;
  const duration = days.data?.durationMinutes;

  if (days.error) return <p role="alert" className="text-danger">{days.error}</p>;
  if (days.loading || !days.data) {
    return (
      <div className="grid h-40 place-items-center text-ink-2">
        <Spinner />
      </div>
    );
  }

  const last = dayList[dayList.length - 1]?.date;
  return (
    <div className="flex flex-col gap-6">
      {duration ? <p className="text-ink-2">Takes about {minutesLabel(duration)} in total.</p> : null}
      <div>
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="font-bold">
            {dayList.length ? `${dayLabel(dayList[0].date, { day: 'numeric', month: 'short' })} – ${dayLabel(last!, { day: 'numeric', month: 'short' })}` : 'Dates'}
          </h3>
          <div className="flex gap-2">
            <button
              type="button"
              aria-label="Earlier dates"
              disabled={windows.length === 1}
              onClick={() => {
                setWindows((w) => w.slice(0, -1));
                onChange(null);
              }}
              className="grid size-9 place-items-center rounded-full border border-line-2 hover:border-ink disabled:opacity-30 disabled:hover:border-line-2"
            >
              <ChevronLeftIcon className="size-4" />
            </button>
            <button
              type="button"
              aria-label="Later dates"
              disabled={!last}
              onClick={() => {
                if (!last) return;
                setWindows((w) => [...w, addDays(last, 1)]);
                onChange(null);
              }}
              className="grid size-9 place-items-center rounded-full border border-line-2 hover:border-ink disabled:opacity-30"
            >
              <ChevronRightIcon className="size-4" />
            </button>
          </div>
        </div>
        <div role="radiogroup" aria-label="Date" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2 [scrollbar-width:thin]">
          {dayList.map((d) => {
            const selected = d.date === selectedDate;
            return (
              <button
                key={d.date}
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={!d.hasSlots}
                onClick={() => onChange({ date: d.date, time: null })}
                aria-label={`${dayLabel(d.date, { weekday: 'long', day: 'numeric', month: 'long' })}${d.hasSlots ? '' : d.isOpen ? ', fully booked' : ', closed'}`}
                className={cx(
                  'flex w-16 shrink-0 flex-col items-center rounded-2xl border py-2.5 transition-colors',
                  selected ? 'border-ink bg-ink text-white' : 'border-line-2 hover:border-ink',
                  !d.hasSlots && 'border-line text-ink-3 line-through hover:border-line',
                )}
              >
                <span className="text-xs font-semibold uppercase">{dayLabel(d.date, { weekday: 'short' })}</span>
                <span className="text-lg font-bold">{dayLabel(d.date, { day: 'numeric' })}</span>
                <span className="text-[11px]">{dayLabel(d.date, { month: 'short' })}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <h3 className="mb-3 font-bold">{selectedDate ? `Times on ${dayLabel(selectedDate, { weekday: 'long', day: 'numeric', month: 'long' })}` : 'Times'}</h3>
        {!selectedDate ? (
          <p className="text-ink-2">No open times in these two weeks. Try later dates{staffId ? ' or another staff member' : ''}.</p>
        ) : slots.error ? (
          <p role="alert" className="text-danger">{slots.error}</p>
        ) : !slots.data ? (
          <div className="grid h-24 place-items-center text-ink-2">
            <Spinner />
          </div>
        ) : slots.data.slots.length === 0 ? (
          <p className="text-ink-2">No times left on this day. Try another date.</p>
        ) : (
          <div role="radiogroup" aria-label="Time" className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
            {slots.data.slots.map((s) => {
              const selected = s.time === selectedTime;
              return (
                <button
                  key={s.time}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => onChange({ date: selectedDate, time: s.time })}
                  className={cx(
                    'rounded-xl border py-2.5 text-[15px] font-semibold transition-colors',
                    selected ? 'border-ink bg-ink text-white' : 'border-line-2 hover:border-ink',
                  )}
                >
                  {timeLabel(s.time)}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export function isComplete(choice: SlotChoice | null): choice is { date: string; time: string } {
  return !!choice?.date && !!choice.time;
}
