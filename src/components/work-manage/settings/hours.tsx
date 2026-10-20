'use client';

import { useState } from 'react';
import { Select, Switch } from '@/components/ui/field';
import { Card } from '@/components/ui/misc';
import { toast } from '@/components/ui/toast';
import { useWork } from '@/components/work/context';
import { api, errorMessage } from '@/lib/api';
import { timeLabel } from '@/lib/format';
import type { DayHours, WeeklyHours } from '@/types/business';
import type { BusinessDetail } from '@/types/work-manage';
import { WEEKDAYS } from '../shared';
import { SaveBar, SettingsSection } from './common';

// Quarter-hour choices. Close can also be 24:00 (open until midnight); the
// server doesn't support overnight hours.
const TIMES = Array.from({ length: 96 }, (_, i) => `${String(Math.floor(i / 4)).padStart(2, '0')}:${String((i % 4) * 15).padStart(2, '0')}`);
const CLOSE_TIMES = [...TIMES.slice(1), '24:00'];
const label = (t: string) => (t === '24:00' ? 'Midnight' : timeLabel(t));

// Keep a saved off-grid time (e.g. 09:10) selectable.
const withValue = (list: string[], v: string) => (list.includes(v) ? list : [...list, v].sort());

const EMPTY: WeeklyHours = { monday: null, tuesday: null, wednesday: null, thursday: null, friday: null, saturday: null, sunday: null };

export function HoursSettings() {
  return (
    <SettingsSection title="Working hours" subtitle="When customers can book. Team members can work fewer days from their Team page.">
      {(b, reload) => <HoursForm business={b} reload={reload} />}
    </SettingsSection>
  );
}

function HoursForm({ business, reload }: { business: BusinessDetail; reload: () => void }) {
  const { businessId } = useWork();
  const initial = business.workingHours?.weeklyHours ?? EMPTY;
  const [hours, setHours] = useState<WeeklyHours>(initial);
  const [saving, setSaving] = useState(false);
  const dirty = JSON.stringify(hours) !== JSON.stringify(initial);
  const invalid = WEEKDAYS.some((d) => {
    const h = hours[d.key];
    return h && h.close <= h.open && h.close !== '24:00';
  });

  const setDay = (key: keyof WeeklyHours, value: DayHours) => setHours((h) => ({ ...h, [key]: value }));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api(`/businesses/${businessId}/working-hours`, { method: 'PUT', body: { weeklyHours: hours } });
      toast.success('Working hours saved');
      reload();
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't save your hours."));
    } finally {
      setSaving(false);
    }
  };

  // Copy the first open day's hours to every other open day.
  const firstOpen = WEEKDAYS.map((d) => hours[d.key]).find(Boolean);

  return (
    <form onSubmit={save} className="flex flex-col gap-4">
      <Card className="p-0!">
        <ul className="divide-y divide-line">
          {WEEKDAYS.map((d) => {
            const h = hours[d.key];
            const bad = h && h.close <= h.open && h.close !== '24:00';
            return (
              <li key={d.key} className="flex flex-wrap items-center gap-x-6 gap-y-3 px-5 py-4">
                <div className="flex w-40 items-center gap-3">
                  <Switch
                    checked={!!h}
                    label={`Open on ${d.label}`}
                    onChange={(on) => setDay(d.key, on ? (firstOpen ?? { open: '09:00', close: '18:00' }) : null)}
                  />
                  <span className="font-semibold">{d.label}</span>
                </div>
                {h ? (
                  <div className="flex flex-1 flex-wrap items-center gap-3">
                    <Select aria-label={`${d.label} opens`} value={h.open} onChange={(e) => setDay(d.key, { ...h, open: e.target.value })} className="w-36">
                      {withValue(TIMES, h.open).map((t) => (
                        <option key={t} value={t}>
                          {label(t)}
                        </option>
                      ))}
                    </Select>
                    <span className="text-ink-2">to</span>
                    <Select aria-label={`${d.label} closes`} value={h.close} onChange={(e) => setDay(d.key, { ...h, close: e.target.value })} className="w-36">
                      {withValue(CLOSE_TIMES, h.close).map((t) => (
                        <option key={t} value={t}>
                          {label(t)}
                        </option>
                      ))}
                    </Select>
                    {bad ? <p className="text-sm text-danger">Closing must be after opening.</p> : null}
                  </div>
                ) : (
                  <p className="flex-1 text-ink-3">Closed</p>
                )}
              </li>
            );
          })}
        </ul>
      </Card>
      {firstOpen ? (
        <button
          type="button"
          className="self-start text-sm font-semibold text-brand hover:underline"
          onClick={() => setHours((h) => Object.fromEntries(WEEKDAYS.map((d) => [d.key, h[d.key] ? firstOpen : null])) as WeeklyHours)}
        >
          Use {label(firstOpen.open)} – {label(firstOpen.close)} for every open day
        </button>
      ) : null}
      <SaveBar dirty={dirty} saving={saving} disabled={invalid} onReset={() => setHours(initial)} />
    </form>
  );
}
