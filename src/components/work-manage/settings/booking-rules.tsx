'use client';

import { useState } from 'react';
import { Input, Select } from '@/components/ui/field';
import { Card } from '@/components/ui/misc';
import { toast } from '@/components/ui/toast';
import { useWork } from '@/components/work/context';
import { api, errorMessage } from '@/lib/api';
import type { BookingSettings } from '@/types/business';
import type { BusinessDetail } from '@/types/work-manage';
import { SectionTitle, digitsOnly } from '../shared';
import { SaveBar, SettingsSection } from './common';

// The server's allowed start-time grids (must divide an hour evenly).
const SLOT_INTERVALS = [5, 10, 15, 20, 30, 60];
const BUFFERS = [0, 5, 10, 15, 20, 30, 45, 60, 90, 120];
const LEADS = [0, 15, 30, 60, 120, 180, 240, 360, 720, 1440, 2880, 4320, 10080];

// Same defaults the server applies until the owner changes anything.
const DEFAULTS: BookingSettings = { timezone: 'Africa/Nairobi', slotIntervalMinutes: 15, bufferMinutes: 0, minLeadMinutes: 30, maxDaysAhead: 30 };

function minutesLabel(m: number): string {
  if (m === 0) return 'None';
  if (m % 1440 === 0) return `${m / 1440} ${m === 1440 ? 'day' : 'days'}`;
  if (m % 60 === 0) return `${m / 60} ${m === 60 ? 'hour' : 'hours'}`;
  return `${m} min`;
}

const withValue = (list: number[], v: number) => (list.includes(v) ? list : [...list, v].sort((a, b) => a - b));

export function BookingRulesSettings() {
  return (
    <SettingsSection title="Booking rules" subtitle="These shape the times customers can pick.">
      {(b, reload) => <RulesForm business={b} reload={reload} />}
    </SettingsSection>
  );
}

function RulesForm({ business, reload }: { business: BusinessDetail; reload: () => void }) {
  const { businessId } = useWork();
  const initial = business.bookingSettings ?? DEFAULTS;
  const [slot, setSlot] = useState(initial.slotIntervalMinutes);
  const [buffer, setBuffer] = useState(initial.bufferMinutes);
  const [lead, setLead] = useState(initial.minLeadMinutes);
  const [ahead, setAhead] = useState(String(initial.maxDaysAhead));
  const [saving, setSaving] = useState(false);

  const aheadNum = Number(ahead);
  const aheadError = !(aheadNum >= 1 && aheadNum <= 365) ? 'Between 1 and 365 days.' : undefined;
  // Only changed fields are sent (PATCH).
  const patch: Partial<BookingSettings> = {};
  if (slot !== initial.slotIntervalMinutes) patch.slotIntervalMinutes = slot;
  if (buffer !== initial.bufferMinutes) patch.bufferMinutes = buffer;
  if (lead !== initial.minLeadMinutes) patch.minLeadMinutes = lead;
  if (aheadNum !== initial.maxDaysAhead) patch.maxDaysAhead = aheadNum;
  const dirty = Object.keys(patch).length > 0;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (aheadError || !dirty) return;
    setSaving(true);
    try {
      await api<BookingSettings>(`/businesses/${businessId}/booking-settings`, { method: 'PATCH', body: patch });
      toast.success('Booking rules saved');
      reload();
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't save."));
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    setSlot(initial.slotIntervalMinutes);
    setBuffer(initial.bufferMinutes);
    setLead(initial.minLeadMinutes);
    setAhead(String(initial.maxDaysAhead));
  };

  return (
    <form onSubmit={save} className="flex flex-col gap-6" noValidate>
      <Card>
        <SectionTitle title="Times" subtitle={`All times are in ${initial.timezone.replace('_', ' ')}.`} />
        <div className="grid gap-5 md:grid-cols-2">
          <Select label="Start times every" value={slot} onChange={(e) => setSlot(Number(e.target.value))} hint="The grid customers pick start times from.">
            {SLOT_INTERVALS.map((m) => (
              <option key={m} value={m}>
                {m === 60 ? '1 hour' : `${m} minutes`}
              </option>
            ))}
          </Select>
          <Select label="Break after each booking" value={buffer} onChange={(e) => setBuffer(Number(e.target.value))} hint="Kept free for clean-up and turnover.">
            {withValue(BUFFERS, buffer).map((m) => (
              <option key={m} value={m}>
                {minutesLabel(m)}
              </option>
            ))}
          </Select>
        </div>
      </Card>
      <Card>
        <SectionTitle title="Notice" />
        <div className="grid gap-5 md:grid-cols-2">
          <Select label="Earliest booking from now" value={lead} onChange={(e) => setLead(Number(e.target.value))} hint="How much notice you need.">
            {withValue(LEADS, lead).map((m) => (
              <option key={m} value={m}>
                {m === 0 ? 'Right away' : minutesLabel(m)}
              </option>
            ))}
          </Select>
          <Input
            label="Book up to (days ahead)"
            inputMode="numeric"
            value={ahead}
            onChange={(e) => setAhead(digitsOnly(e.target.value, 3))}
            error={aheadError}
            hint="How far into the future customers can book."
          />
        </div>
      </Card>
      <SaveBar dirty={dirty} saving={saving} disabled={!!aheadError} onReset={reset} />
    </form>
  );
}
