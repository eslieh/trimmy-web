'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { Card } from '@/components/ui/misc';
import { toast } from '@/components/ui/toast';
import { useWork } from '@/components/work/context';
import { ApiError, api, errorMessage, toQuery } from '@/lib/api';
import { addDays, cx, dateKey, dayLabel, timeLabel } from '@/lib/format';
import type { CreateTimeOffInput, TimeOff } from '@/types/work-manage';
import { ConfirmModal, ErrorBlock, Loading, SectionTitle } from './shared';
import { useApi } from './use-api';

// The API returns at most 62 days per call: show the next two months.
const WINDOW_DAYS = 61;

function when(t: TimeOff): string {
  const days = t.until && t.until !== t.date ? `${dayLabel(t.date)} – ${dayLabel(t.until)}` : dayLabel(t.date);
  if (t.allDay) return `${days} · all day`;
  return `${days} · ${timeLabel(t.start)} – ${t.end === '24:00' ? 'midnight' : timeLabel(t.end)}`;
}

export function TimeOffPanel({ staffId, name }: { staffId: string; name: string }) {
  const { businessId } = useWork();
  const today = dateKey();
  const { data, error, loading, reload } = useApi<{ timeOff: TimeOff[] }>(
    `/businesses/${businessId}/time-off${toQuery({ from: today, to: addDays(today, WINDOW_DAYS), staffId })}`,
  );
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<TimeOff | null>(null);
  const list = [...(data?.timeOff ?? [])].sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));

  return (
    <Card>
      <SectionTitle
        title="Time off"
        subtitle="Customers can't book them during these times. Next two months."
        action={
          <Button size="sm" variant="secondary" onClick={() => setAdding(true)}>
            Add time off
          </Button>
        }
      />
      {error && !data ? (
        <ErrorBlock message={error} onRetry={reload} />
      ) : loading && !data ? (
        <Loading className="py-8" />
      ) : list.length === 0 ? (
        <p className="py-6 text-center text-sm text-ink-2">No time off coming up.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line">
          {list.map((t) => (
            <li key={t.timeOffId} className="flex items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{when(t)}</p>
                {t.reason ? <p className="truncate text-sm text-ink-2">{t.reason}</p> : null}
              </div>
              <Button size="sm" variant="ghost" className="text-danger" onClick={() => setRemoving(t)} aria-label={`Remove time off ${when(t)}`}>
                Remove
              </Button>
            </li>
          ))}
        </ul>
      )}
      <AddTimeOffModal
        open={adding}
        staffId={staffId}
        name={name}
        onClose={() => setAdding(false)}
        onDone={() => {
          setAdding(false);
          reload();
        }}
      />
      <ConfirmModal
        open={!!removing}
        onClose={() => setRemoving(null)}
        title="Remove time off?"
        body={removing ? `${name} becomes bookable again on ${when(removing)}.` : null}
        confirmLabel="Remove"
        danger
        onConfirm={async () => {
          if (!removing) return;
          try {
            await api(`/time-off/${removing.timeOffId}`, { method: 'DELETE' });
            toast.success('Time off removed');
            setRemoving(null);
            reload();
          } catch (err) {
            toast.error(errorMessage(err, "Couldn't remove it."));
          }
        }}
      />
    </Card>
  );
}

function AddTimeOffModal({ open, staffId, name, onClose, onDone }: { open: boolean; staffId: string; name: string; onClose: () => void; onDone: () => void }) {
  const { businessId } = useWork();
  const today = dateKey();
  const [allDay, setAllDay] = useState(true);
  const [date, setDate] = useState(today);
  const [until, setUntil] = useState(today);
  const [start, setStart] = useState('12:00');
  const [end, setEnd] = useState('14:00');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!date) return setError('Pick a date.');
    if (allDay && until && until < date) return setError('The last day is before the first.');
    if (!allDay && end <= start) return setError('The end time must be after the start.');
    const input: CreateTimeOffInput = allDay
      ? { date, allDay: true, until: until && until !== date ? until : undefined, reason: reason.trim() || undefined }
      : { date, start, end, reason: reason.trim() || undefined };
    setSaving(true);
    setError(null);
    try {
      await api(`/businesses/${businessId}/staff/${staffId}/time-off`, { method: 'POST', body: input });
      toast.success('Time off added');
      setReason('');
      onDone();
    } catch (err) {
      // 409 has_bookings: they're booked then, so those bookings need moving first.
      const refs = err instanceof ApiError && Array.isArray(err.body?.references) ? (err.body.references as string[]) : null;
      setError(
        errorMessage(err, "Couldn't add time off.") +
          (err instanceof ApiError && err.code === 'has_bookings' && refs?.length ? ` Bookings: ${refs.join(', ')}.` : ''),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Time off for ${name}`}
      locked={saving}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="time-off-form" loading={saving}>
            Add time off
          </Button>
        </div>
      }
    >
      <form id="time-off-form" onSubmit={submit} className="flex flex-col gap-4 pb-2" noValidate>
        <div role="radiogroup" aria-label="Length" className="flex gap-2">
          {[true, false].map((v) => (
            <button
              key={String(v)}
              type="button"
              role="radio"
              aria-checked={allDay === v}
              onClick={() => setAllDay(v)}
              className={cx('rounded-full px-4 py-2 text-sm font-semibold', allDay === v ? 'bg-ink text-white' : 'bg-surface-3')}
            >
              {v ? 'Whole days' : 'Part of a day'}
            </button>
          ))}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            type="date"
            label={allDay ? 'First day' : 'Date'}
            value={date}
            min={today}
            onChange={(e) => {
              setDate(e.target.value);
              if (until < e.target.value) setUntil(e.target.value);
            }}
          />
          {allDay ? (
            <Input type="date" label="Last day" value={until} min={date} onChange={(e) => setUntil(e.target.value)} />
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <Input type="time" label="From" value={start} step={300} onChange={(e) => setStart(e.target.value)} />
              <Input type="time" label="To" value={end} step={300} onChange={(e) => setEnd(e.target.value)} />
            </div>
          )}
        </div>
        <Input label="Reason (optional)" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Leave, doctor's appointment" maxLength={100} />
        {error ? (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : null}
      </form>
    </Modal>
  );
}
