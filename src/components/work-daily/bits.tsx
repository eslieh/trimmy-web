'use client';

import { Badge } from '@/components/ui/misc';
import { Button, Spinner } from '@/components/ui/button';
import { errorMessage } from '@/lib/api';
import { addDays, cx, dayLabel, money, timeLabel } from '@/lib/format';
import type { Booking } from '@/types/booking';
import { STATUS_DOT, STATUS_LABEL, STATUS_TONE, servicesLabel } from './status';

// Small pieces shared by the daily-work pages.

export function StatusBadge({ status }: { status: Booking['status'] }) {
  return <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>;
}

export function Loading({ label = 'Loading…', className }: { label?: string; className?: string }) {
  return (
    <div className={cx('flex items-center justify-center gap-3 py-16 text-ink-2', className)}>
      <Spinner className="size-5" />
      <span className="text-sm">{label}</span>
    </div>
  );
}

export function LoadError({ error, onRetry, title = "Couldn't load this" }: { error: unknown; onRetry?: () => void; title?: string }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-3 rounded-card border border-danger/20 bg-danger/5 px-6 py-10 text-center">
      <p className="font-bold">{title}</p>
      <p className="max-w-md text-sm text-ink-2">{errorMessage(error)}</p>
      {onRetry ? (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}

export function InlineError({ children }: { children: React.ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">
      {children}
    </p>
  );
}

export function Chevron({ dir }: { dir: 'left' | 'right' }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d={dir === 'left' ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'} stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconButton({ label, onClick, children, disabled }: { label: string; onClick: () => void; children: React.ReactNode; disabled?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className="grid size-9 place-items-center rounded-full border border-line-2 bg-white text-ink transition-colors hover:border-ink disabled:opacity-40"
    >
      {children}
    </button>
  );
}

// ‹ Tue 21 Oct › with a date field and "Today".
export function DateNav({ date, today, onChange, max }: { date: string; today: string; onChange: (d: string) => void; max?: string }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <IconButton label="Previous day" onClick={() => onChange(addDays(date, -1))}>
        <Chevron dir="left" />
      </IconButton>
      <label className="relative">
        <span className="sr-only">Date</span>
        <input
          type="date"
          value={date}
          max={max}
          onChange={(e) => e.target.value && onChange(e.target.value)}
          className="h-9 rounded-full border border-line-2 bg-white px-3 text-sm font-semibold outline-none focus:border-ink"
        />
      </label>
      <IconButton label="Next day" onClick={() => onChange(addDays(date, 1))} disabled={!!max && date >= max}>
        <Chevron dir="right" />
      </IconButton>
      {date !== today ? (
        <Button variant="ghost" size="sm" onClick={() => onChange(today)}>
          Today
        </Button>
      ) : null}
    </div>
  );
}

// One booking as a compact row (Today's list view, a calendar day, customer history).
export function BookingRow({ booking, onOpen, showDate, active }: { booking: Booking; onOpen: (b: Booking) => void; showDate?: boolean; active?: boolean }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(booking)}
      aria-current={active ? 'true' : undefined}
      className={cx(
        'flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-2',
        active && 'bg-surface-2',
      )}
    >
      <span className={cx('size-2.5 shrink-0 rounded-full', STATUS_DOT[booking.status])} aria-hidden />
      <span className="w-20 shrink-0 text-sm">
        {showDate ? <span className="block text-xs text-ink-2">{dayLabel(booking.date)}</span> : null}
        <span className="font-semibold tabular-nums">{timeLabel(booking.time)}</span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold">{booking.customerName}</span>
        <span className="block truncate text-sm text-ink-2">
          {servicesLabel(booking)} · {booking.staffId ? booking.staffName : 'Unassigned'}
        </span>
      </span>
      <span className="hidden shrink-0 text-right text-sm sm:block">
        <span className="block font-semibold tabular-nums">{money(booking.totalAmount)}</span>
        {booking.refund?.status === 'due' ? <span className="block text-xs font-semibold text-danger">Refund owed</span> : null}
      </span>
      <span className="shrink-0">
        <StatusBadge status={booking.status} />
      </span>
    </button>
  );
}

export function SummaryRow({ label, value, muted, strong }: { label: React.ReactNode; value: React.ReactNode; muted?: boolean; strong?: boolean }) {
  return (
    <div className={cx('flex items-baseline justify-between gap-4 py-1.5 text-[15px]', muted && 'text-ink-2', strong && 'font-bold')}>
      <span>{label}</span>
      <span className="text-right tabular-nums">{value}</span>
    </div>
  );
}

// Pill-style radio group (tip presets, payment method, list/grid toggles).
export function Segmented<T extends string | number>({
  value, onChange, options, label,
}: { value: T | null; onChange: (v: T) => void; options: { key: T; label: string }[]; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={String(o.key)}
          type="button"
          role="radio"
          aria-checked={o.key === value}
          onClick={() => onChange(o.key)}
          className={cx(
            'h-9 rounded-full border px-4 text-sm font-semibold transition-colors',
            o.key === value ? 'border-ink bg-ink text-white' : 'border-line-2 bg-white text-ink hover:border-ink',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
