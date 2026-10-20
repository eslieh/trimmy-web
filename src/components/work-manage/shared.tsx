'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Button, Spinner } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { cx } from '@/lib/format';
import type { WeeklyHours } from '@/types/business';
import type { InvitationStatus, TeamRole } from '@/types/team';

export type Weekday = keyof WeeklyHours;

export const WEEKDAYS: { key: Weekday; short: string; label: string }[] = [
  { key: 'monday', short: 'Mon', label: 'Monday' },
  { key: 'tuesday', short: 'Tue', label: 'Tuesday' },
  { key: 'wednesday', short: 'Wed', label: 'Wednesday' },
  { key: 'thursday', short: 'Thu', label: 'Thursday' },
  { key: 'friday', short: 'Fri', label: 'Friday' },
  { key: 'saturday', short: 'Sat', label: 'Saturday' },
  { key: 'sunday', short: 'Sun', label: 'Sunday' },
];

export const ROLE_LABEL: Record<TeamRole, string> = { staff: 'Staff', front_desk: 'Front desk' };

export const INVITE_STATUS: Record<InvitationStatus, { label: string; tone: 'success' | 'warning' | 'danger' }> = {
  accepted: { label: 'Active', tone: 'success' },
  pending: { label: 'Invited', tone: 'warning' },
  declined: { label: 'Declined', tone: 'danger' },
};

export const METHOD_LABEL: Record<string, string> = { mpesa: 'M-Pesa', cash: 'Cash' };

export function workingDaysLabel(days: Weekday[] | null): string {
  if (days === null) return 'Whenever the business is open';
  if (days.length === 0) return 'No days set';
  if (days.length === 7) return 'Every day';
  return WEEKDAYS.filter((d) => days.includes(d.key)).map((d) => d.short).join(', ');
}

export function dateTimeLabel(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function BackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-2 hover:text-ink">
      <span aria-hidden>←</span> {children}
    </Link>
  );
}

export function SectionTitle({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="text-lg font-bold">{title}</h2>
        {subtitle ? <p className="mt-0.5 text-sm text-ink-2">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function Loading({ label = 'Loading…', className }: { label?: string; className?: string }) {
  return (
    <div className={cx('flex items-center justify-center gap-3 py-16 text-ink-2', className)}>
      <Spinner /> <span>{label}</span>
    </div>
  );
}

export function ErrorBlock({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-3 rounded-card border border-danger/20 bg-danger/5 px-6 py-10 text-center">
      <p className="font-semibold text-danger">{message}</p>
      {onRetry ? (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}

export function Stat({ label, value, hint, tone }: { label: string; value: React.ReactNode; hint?: React.ReactNode; tone?: 'success' | 'danger' | 'warning' }) {
  return (
    <div className="rounded-card border border-line bg-white p-4 shadow-card sm:p-5">
      <p className="text-[13px] font-semibold text-ink-2">{label}</p>
      <p
        className={cx(
          'mt-1 text-xl font-extrabold tracking-tight tabular-nums sm:text-2xl',
          tone === 'success' && 'text-success',
          tone === 'danger' && 'text-danger',
          tone === 'warning' && 'text-warning',
        )}
      >
        {value}
      </p>
      {hint ? <div className="mt-1 text-[13px] text-ink-2">{hint}</div> : null}
    </div>
  );
}

// Toggle chips for picking working days. null = follow the business's own days.
export function WorkingDaysPicker({ value, onChange, disabled }: { value: Weekday[] | null; onChange: (v: Weekday[] | null) => void; disabled?: boolean }) {
  const follows = value === null;
  return (
    <fieldset className="flex flex-col gap-3" disabled={disabled}>
      <legend className="sr-only">Working days</legend>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" className="size-4 accent-ink" checked={follows} onChange={(e) => onChange(e.target.checked ? null : WEEKDAYS.slice(0, 6).map((d) => d.key))} />
        Works whenever the business is open
      </label>
      {!follows ? (
        <div className="flex flex-wrap gap-2">
          {WEEKDAYS.map((d) => {
            const on = value.includes(d.key);
            return (
              <button
                key={d.key}
                type="button"
                aria-pressed={on}
                aria-label={d.label}
                onClick={() => onChange(on ? value.filter((k) => k !== d.key) : WEEKDAYS.map((w) => w.key).filter((k) => k === d.key || value.includes(k)))}
                className={cx(
                  'h-10 min-w-12 rounded-full border px-3 text-sm font-semibold transition-colors',
                  on ? 'border-ink bg-ink text-white' : 'border-line-2 bg-white text-ink hover:border-ink',
                )}
              >
                {d.short}
              </button>
            );
          })}
        </div>
      ) : null}
    </fieldset>
  );
}

// A yes / no dialog for destructive or money-moving actions.
export function ConfirmModal({
  open, onClose, title, body, confirmLabel, onConfirm, danger, children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  body?: React.ReactNode;
  confirmLabel: string;
  onConfirm: () => Promise<unknown> | void;
  danger?: boolean;
  children?: React.ReactNode;
}) {
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      locked={busy}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={run} loading={busy}>
            {confirmLabel}
          </Button>
        </div>
      }
    >
      {body ? <div className="text-ink-2">{body}</div> : null}
      {children}
    </Modal>
  );
}

// Plain table shell: scrolls sideways on phones instead of squashing columns.
export function Table({ head, children, className }: { head: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={cx('-mx-5 overflow-x-auto px-5', className)}>
      <table className="w-full min-w-[520px] text-left text-sm">
        <thead className="border-b border-line text-[13px] text-ink-2">{head}</thead>
        <tbody className="divide-y divide-line">{children}</tbody>
      </table>
    </div>
  );
}

export const th = 'py-2.5 pr-4 font-semibold last:pr-0';
export const td = 'py-3 pr-4 align-middle last:pr-0';

// Whole-number input that keeps the raw text while typing.
export function digitsOnly(v: string, max = 9): string {
  return v.replace(/\D/g, '').slice(0, max);
}
