'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Avatar } from '@/components/ui/misc';
import { cx, timeLabel } from '@/lib/format';
import type { Booking } from '@/types/booking';
import { STATUS_BLOCK, STATUS_LABEL, servicesLabel } from './status';
import { hourLabel, toMinutes, toTime } from './time';

// One day as staff columns × time rows (the web twin of mobile's
// StaffDayGrid): who is free when, at a glance. Every booking is one
// absolutely-positioned block. Click a booking to open it, an empty spot to
// book that person then, a name to manage their time off.

export type GridColumn = { staffId: string | null; name: string; avatarUrl?: string | null }; // null = "Any available"
export type BlockedTime = { staffId: string; start: string; end: string; label: string };

const HOUR_HEIGHT = 72;
const PX_PER_MIN = HOUR_HEIGHT / 60;
const SLOT_MINUTES = 15;
const MIN_BLOCK = 22;

// Overlapping blocks in one column (only "Any available" should have them) share its width.
function lanes(bookings: Booking[]): Map<string, { lane: number; of: number }> {
  const sorted = [...bookings].sort((a, b) => toMinutes(a.time) - toMinutes(b.time));
  const result = new Map<string, { lane: number; of: number }>();
  let group: { id: string; lane: number }[] = [];
  let groupEnd = -1;
  let laneEnds: number[] = [];
  const flush = () => {
    const of = Math.max(1, laneEnds.length);
    group.forEach(({ id, lane }) => result.set(id, { lane, of }));
    group = [];
    laneEnds = [];
  };
  for (const b of sorted) {
    const start = toMinutes(b.time);
    const end = start + b.durationMinutes;
    if (start >= groupEnd) flush();
    let lane = laneEnds.findIndex((e) => e <= start);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(end);
    } else laneEnds[lane] = end;
    group.push({ id: b.bookingId, lane });
    groupEnd = Math.max(groupEnd, end);
  }
  flush();
  return result;
}

export function DayGrid({
  columns, bookings, blocked, openTime, closeTime, nowMinutes, selectedId, onOpenBooking, onPickSlot, onPickStaff,
}: {
  columns: GridColumn[];
  bookings: Booking[];
  blocked: BlockedTime[];
  openTime: string | null; // null = closed that day
  closeTime: string | null;
  nowMinutes: number | null; // set only when the day shown is today
  selectedId?: string | null;
  onOpenBooking: (b: Booking) => void;
  onPickSlot: (staffId: string | null, time: string) => void;
  onPickStaff: (column: GridColumn) => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<{ col: number; minutes: number } | null>(null);

  // The day's hours, widened to cover anything booked outside them.
  const { start, end } = useMemo(() => {
    let s = openTime ? toMinutes(openTime) : 8 * 60;
    let e = closeTime ? toMinutes(closeTime) : 20 * 60;
    for (const b of bookings) {
      s = Math.min(s, toMinutes(b.time));
      e = Math.max(e, toMinutes(b.time) + b.durationMinutes);
    }
    return { start: Math.floor(s / 60) * 60, end: Math.min(24 * 60, Math.ceil(e / 60) * 60) };
  }, [openTime, closeTime, bookings]);
  const height = (end - start) * PX_PER_MIN;
  const hours = useMemo(() => {
    const list: number[] = [];
    for (let m = start; m <= end; m += 60) list.push(m);
    return list;
  }, [start, end]);

  const byColumn = useMemo(() => {
    const map = new Map<string, Booking[]>();
    for (const b of bookings) {
      const key = b.staffId ?? 'any';
      map.set(key, [...(map.get(key) ?? []), b]);
    }
    return map;
  }, [bookings]);

  // Open on the current time (or opening time), once per day shown.
  const firstScroll = useRef<string | null>(null);
  useEffect(() => {
    const key = `${start}-${openTime}`;
    if (!scroller.current || firstScroll.current === key) return;
    firstScroll.current = key;
    const focus = nowMinutes ?? (openTime ? toMinutes(openTime) : start);
    scroller.current.scrollTop = Math.max(0, (focus - start - 45) * PX_PER_MIN);
  }, [start, openTime, nowMinutes]);

  const open = openTime ? toMinutes(openTime) : null;
  const close = closeTime ? toMinutes(closeTime) : null;

  const slotAt = (col: number, offsetY: number): number | null => {
    const minutes = start + Math.floor(offsetY / PX_PER_MIN / SLOT_MINUTES) * SLOT_MINUTES;
    if (open === null || close === null || minutes < open || minutes >= close) return null;
    if (nowMinutes !== null && minutes + SLOT_MINUTES <= nowMinutes) return null;
    const column = columns[col];
    if (column?.staffId) {
      const inBlock = blocked.some((b) => b.staffId === column.staffId && minutes >= toMinutes(b.start) && minutes < toMinutes(b.end));
      if (inBlock) return null;
    }
    return minutes;
  };

  return (
    <div ref={scroller} className="relative max-h-[calc(100dvh-15rem)] min-h-[420px] overflow-auto rounded-card border border-line bg-white">
      <div style={{ minWidth: 56 + columns.length * 150 }}>
        {/* Staff names: sticky at the top. */}
        <div className="sticky top-0 z-20 flex border-b border-line bg-white">
          <div className="sticky left-0 z-30 w-14 shrink-0 bg-white" />
          {columns.map((c) => (
            <div key={c.staffId ?? 'any'} className="min-w-[150px] flex-1 border-l border-line">
              {c.staffId ? (
                <button
                  type="button"
                  onClick={() => onPickStaff(c)}
                  title={`${c.name}: time off`}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left hover:bg-surface-2"
                >
                  <Avatar name={c.name} src={c.avatarUrl} size={28} />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{c.name}</span>
                    <span className="block text-xs text-ink-3">Time off</span>
                  </span>
                </button>
              ) : (
                <div className="flex items-center gap-2 px-3 py-2.5">
                  <span className="size-7 shrink-0 rounded-full border-[1.5px] border-dashed border-line-3" aria-hidden />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">Any available</span>
                    <span className="block text-xs text-ink-3">Unassigned</span>
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="relative flex" style={{ height }}>
          {/* Hour labels, sticky on the left. */}
          <div className="sticky left-0 z-10 w-14 shrink-0 border-r border-line bg-white">
            {hours.map((m) => (
              <span key={m} className="absolute right-2 text-[11px] text-ink-3 tabular-nums" style={{ top: (m - start) * PX_PER_MIN - 7 }}>
                {m < end ? hourLabel(m) : ''}
              </span>
            ))}
          </div>

          <div className="relative flex flex-1">
            {/* Hour and half-hour lines. */}
            {hours.map((m) => (
              <div key={m} className="pointer-events-none absolute inset-x-0 border-t border-line" style={{ top: (m - start) * PX_PER_MIN }} />
            ))}
            {hours.slice(0, -1).map((m) => (
              <div key={`h${m}`} className="pointer-events-none absolute inset-x-0 border-t border-dashed border-line/70" style={{ top: (m + 30 - start) * PX_PER_MIN }} />
            ))}
            {/* Outside working hours, shaded. */}
            {open === null || close === null ? (
              <div className="pointer-events-none absolute inset-0 z-[1] flex justify-center bg-surface-2/80 pt-10">
                <span className="text-sm font-semibold text-ink-3">Closed</span>
              </div>
            ) : (
              <>
                {open > start ? <div className="pointer-events-none absolute inset-x-0 top-0 bg-surface-2/70" style={{ height: (open - start) * PX_PER_MIN }} /> : null}
                {close < end ? <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-surface-2/70" style={{ height: (end - close) * PX_PER_MIN }} /> : null}
              </>
            )}

            {columns.map((c, col) => {
              const list = byColumn.get(c.staffId ?? 'any') ?? [];
              const placement = lanes(list);
              const ghost = hover?.col === col ? hover.minutes : null;
              return (
                <div
                  key={c.staffId ?? 'any'}
                  className={cx('relative min-w-[150px] flex-1 border-l border-line', ghost !== null && 'cursor-pointer')}
                  onMouseMove={(e) => {
                    const minutes = slotAt(col, e.clientY - e.currentTarget.getBoundingClientRect().top);
                    setHover(minutes === null ? null : { col, minutes });
                  }}
                  onMouseLeave={() => setHover(null)}
                  onClick={(e) => {
                    if (e.target !== e.currentTarget) return; // a booking or block was clicked
                    const minutes = slotAt(col, e.clientY - e.currentTarget.getBoundingClientRect().top);
                    if (minutes !== null) onPickSlot(c.staffId, toTime(minutes));
                  }}
                >
                  {ghost !== null ? (
                    <div
                      className="pointer-events-none absolute inset-x-1 rounded-md border border-dashed border-ink/40 bg-surface-2 px-2 text-[11px] font-semibold text-ink-2"
                      style={{ top: (ghost - start) * PX_PER_MIN, height: SLOT_MINUTES * PX_PER_MIN * 2 }}
                    >
                      + {timeLabel(toTime(ghost))}
                    </div>
                  ) : null}

                  {blocked
                    .filter((b) => b.staffId === c.staffId)
                    .map((b, i) => {
                      const from = Math.max(toMinutes(b.start), start);
                      const to = Math.min(toMinutes(b.end), end);
                      if (to <= from) return null;
                      return (
                        <button
                          type="button"
                          key={i}
                          onClick={() => onPickStaff(c)}
                          title={`${c.name}: ${b.label}`}
                          className="absolute inset-x-1 z-[2] overflow-hidden rounded-md border border-dashed border-line-3 px-2 py-1 text-left text-[11px] font-semibold text-ink-2"
                          style={{
                            top: (from - start) * PX_PER_MIN,
                            height: Math.max((to - from) * PX_PER_MIN, MIN_BLOCK),
                            background: 'repeating-linear-gradient(135deg, var(--color-surface-3) 0 6px, var(--color-surface-2) 6px 12px)',
                          }}
                        >
                          {b.label}
                        </button>
                      );
                    })}

                  {list.map((b) => {
                    const { lane, of } = placement.get(b.bookingId) ?? { lane: 0, of: 1 };
                    const h = Math.max(b.durationMinutes * PX_PER_MIN - 2, MIN_BLOCK);
                    return (
                      <button
                        type="button"
                        key={b.bookingId}
                        onClick={() => onOpenBooking(b)}
                        aria-label={`${timeLabel(b.time)}, ${b.customerName}, ${servicesLabel(b)}, ${STATUS_LABEL[b.status]}`}
                        className={cx(
                          'absolute z-[3] overflow-hidden rounded-md border-l-[3px] px-2 py-1 text-left transition-shadow hover:shadow-card',
                          STATUS_BLOCK[b.status],
                          selectedId === b.bookingId && 'ring-2 ring-ink',
                        )}
                        style={{
                          top: (toMinutes(b.time) - start) * PX_PER_MIN + 1,
                          height: h,
                          left: `calc(${(lane / of) * 100}% + 3px)`,
                          width: `calc(${100 / of}% - 6px)`,
                        }}
                      >
                        <span className="block truncate text-[11px] leading-4 text-ink-2 tabular-nums">
                          {timeLabel(b.time)}
                          {b.refund?.status === 'due' ? <span className="ml-1 font-semibold text-danger">· refund</span> : null}
                        </span>
                        <span className="block truncate text-[13px] leading-4 font-semibold">{b.customerName}</span>
                        {h >= 48 ? <span className="block truncate text-[11px] leading-4 text-ink-2">{servicesLabel(b)}</span> : null}
                      </button>
                    );
                  })}
                </div>
              );
            })}

            {nowMinutes !== null && nowMinutes >= start && nowMinutes <= end ? (
              <div className="pointer-events-none absolute inset-x-0 z-[4]" style={{ top: (nowMinutes - start) * PX_PER_MIN }}>
                <div className="h-0.5 bg-brand-pink" />
                <div className="absolute -top-1 -left-1 size-2.5 rounded-full bg-brand-pink" />
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
