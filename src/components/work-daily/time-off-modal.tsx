'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input, Switch } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { toast } from '@/components/ui/toast';
import { api, ApiError, errorMessage, toQuery } from '@/lib/api';
import { addDays, dayLabel, timeLabel } from '@/lib/format';
import type { CreateTimeOffInput, TimeOff } from '@/types/work-daily';
import { InlineError, Loading, LoadError } from './bits';
import { useApi } from './use-api';

// One person's time off (team.json list / create / delete-time-off): the
// next few weeks, add a block, remove one. 409 has_bookings lists the
// bookings in the way so they can be moved or reassigned first.
export function TimeOffModal({
  businessId, staff, date, today, onClose, onChanged,
}: {
  businessId: string;
  staff: { staffId: string; name: string } | null;
  date: string; // the day the grid shows: the form's default
  today: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const from = date < today ? date : today;
  const path = staff ? `/businesses/${businessId}/time-off${toQuery({ from, to: addDays(from, 61), staffId: staff.staffId })}` : null;
  const list = useApi<{ timeOff: TimeOff[] }>(path);

  const [form, setForm] = useState({ date, until: date, allDay: false, start: '12:00', end: '13:00', reason: '' });
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [clashes, setClashes] = useState<string[]>([]);

  const add = async () => {
    if (!staff) return;
    setError('');
    setClashes([]);
    if (!form.allDay && form.end <= form.start) return setError('End must be after start.');
    if (form.allDay && form.until < form.date) return setError('The last day must be on or after the first.');
    const reason = form.reason.trim() || undefined;
    const body: CreateTimeOffInput = form.allDay
      ? { date: form.date, allDay: true, ...(form.until > form.date ? { until: form.until } : {}), reason }
      : { date: form.date, start: form.start, end: form.end, reason };
    setSaving(true);
    try {
      await api(`/businesses/${businessId}/staff/${staff.staffId}/time-off`, { method: 'POST', body });
      toast.success(`Time off added for ${staff.name}`);
      setForm((f) => ({ ...f, reason: '' }));
      list.reload();
      onChanged();
    } catch (err) {
      if (err instanceof ApiError && err.code === 'has_bookings') {
        const refs = err.body?.references;
        setClashes(Array.isArray(refs) ? refs.map(String) : []);
      }
      setError(errorMessage(err, "Couldn't add the time off."));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (t: TimeOff) => {
    setRemoving(t.timeOffId);
    try {
      await api(`/time-off/${t.timeOffId}`, { method: 'DELETE' });
      list.setData((d) => ({ timeOff: d.timeOff.filter((x) => x.timeOffId !== t.timeOffId) }));
      toast('Time off removed');
      onChanged();
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't remove it."));
    } finally {
      setRemoving(null);
    }
  };

  const entries = list.data?.timeOff ?? [];

  return (
    <Modal open={!!staff} onClose={onClose} title={staff ? `${staff.name}: time off` : undefined} locked={saving} wide>
      <div className="flex flex-col gap-6 pb-2">
        <section aria-label="Upcoming time off">
          <h3 className="mb-2 text-sm font-semibold text-ink-2">Coming up</h3>
          {list.error && !list.data ? (
            <LoadError error={list.error} onRetry={list.reload} />
          ) : !list.data ? (
            <Loading className="py-6" />
          ) : entries.length === 0 ? (
            <p className="rounded-xl bg-surface-2 px-4 py-3 text-sm text-ink-2">No time off booked in the next two months.</p>
          ) : (
            <ul className="divide-y divide-line rounded-xl border border-line">
              {entries.map((t) => (
                <li key={t.timeOffId} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="font-semibold">
                      {dayLabel(t.date)}
                      {t.until !== t.date ? ` – ${dayLabel(t.until)}` : ''}
                    </p>
                    <p className="text-sm text-ink-2">
                      {t.allDay ? 'All day' : `${timeLabel(t.start)} – ${t.end === '24:00' ? 'end of day' : timeLabel(t.end)}`}
                      {t.reason ? ` · ${t.reason}` : ''}
                    </p>
                  </div>
                  <Button variant="danger" size="sm" loading={removing === t.timeOffId} disabled={!!removing} onClick={() => remove(t)}>
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-label="Add time off" className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-ink-2">Add time off</h3>
          <div className="flex items-center justify-between gap-3">
            <span className="text-[15px] font-semibold">All day</span>
            <Switch label="All day" checked={form.allDay} onChange={(allDay) => setForm((f) => ({ ...f, allDay }))} />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Input
              label={form.allDay ? 'From' : 'Date'}
              type="date"
              min={today}
              value={form.date}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value, until: f.until < e.target.value ? e.target.value : f.until }))}
            />
            {form.allDay ? (
              <Input label="Until (last day)" type="date" min={form.date} value={form.until} onChange={(e) => setForm((f) => ({ ...f, until: e.target.value }))} />
            ) : (
              <>
                <Input label="From" type="time" step={300} value={form.start} onChange={(e) => setForm((f) => ({ ...f, start: e.target.value }))} />
                <Input label="To" type="time" step={300} value={form.end} onChange={(e) => setForm((f) => ({ ...f, end: e.target.value }))} />
              </>
            )}
          </div>
          <Input label="Reason (optional)" placeholder="e.g. Doctor" maxLength={200} value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} />
          <InlineError>{error}</InlineError>
          {clashes.length ? (
            <p className="text-sm text-ink-2">
              Bookings in the way: <span className="font-semibold text-ink">{clashes.join(', ')}</span>. Move or reassign them first.
            </p>
          ) : null}
          <div className="flex justify-end">
            <Button onClick={add} loading={saving} disabled={!form.date}>
              Add time off
            </Button>
          </div>
        </section>
      </div>
    </Modal>
  );
}
