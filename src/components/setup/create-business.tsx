'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LocationPicker } from '@/components/map/location-picker';
import { useSession } from '@/components/session';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/field';
import { toast } from '@/components/ui/toast';
import { BUSINESS_CATEGORIES } from '@/components/work-manage/settings/common';
import { normalizePhone } from '@/components/work-daily/phone';
import { api, errorMessage } from '@/lib/api';
import { cx } from '@/lib/format';
import type { BusinessCategory } from '@/types/business';

// Step 1 of setup for a new business: the basics, including where it is on
// the map. Creates the draft (POST /businesses); every later step edits it.
export function CreateBusinessForm() {
  const router = useRouter();
  const { refresh } = useSession();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [categories, setCategories] = useState<BusinessCategory[]>([]);
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [building, setBuilding] = useState('');
  const [floor, setFloor] = useState('');
  const [unit, setUnit] = useState('');
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);

  const e164 = normalizePhone(phone);
  const errors = {
    name: !name.trim() ? 'Add your business name' : '',
    description: !description.trim() ? 'Tell customers a little about you' : '',
    categories: categories.length === 0 ? 'Pick at least one' : '',
    phone: !e164 ? 'Enter a valid phone number' : '',
    address: !address.trim() ? 'Add the street or area' : '',
    pin: !pin ? 'Pin your business on the map' : '',
  };
  const shown = submitted ? errors : ({} as Partial<typeof errors>);
  const invalid = Object.values(errors).some(Boolean);

  const toggle = (c: BusinessCategory) =>
    setCategories((cur) => (cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c]));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (invalid || !pin || !e164) return;
    setSaving(true);
    try {
      const created = await api<{ businessId: string }>('/businesses', {
        method: 'POST',
        body: {
          name: name.trim(),
          description: description.trim(),
          categories,
          phone: e164,
          location: {
            address: address.trim(),
            lat: pin.lat,
            lng: pin.lng,
            building: building.trim() || undefined,
            floor: floor.trim() || undefined,
            unit: unit.trim() || undefined,
          },
        },
      });
      refresh(); // the new draft joins their workplaces
      router.push(`/setup/${created.businessId}/photos`);
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't create your business."));
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-6" noValidate>
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Tell us about your business</h1>
        <p className="mt-1 text-ink-2">This is what customers see on Trimmy. You can change any of it later.</p>
      </div>
      <Input label="Business name" value={name} onChange={(e) => setName(e.target.value)} error={shown.name} placeholder="e.g. Glow Beauty Studio" />
      <Textarea label="About" value={description} onChange={(e) => setDescription(e.target.value)} error={shown.description} placeholder="What you do, what you're known for" />
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-semibold">What kind of business?</legend>
        <div className="flex flex-wrap gap-2">
          {BUSINESS_CATEGORIES.map((c) => {
            const on = categories.includes(c.value);
            return (
              <button
                key={c.value}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(c.value)}
                className={cx('rounded-full px-4 py-2 text-sm font-semibold', on ? 'bg-ink text-white' : 'bg-surface-3 hover:bg-line')}
              >
                {c.label}
              </button>
            );
          })}
        </div>
        {shown.categories ? <p className="text-[13px] text-danger">{shown.categories}</p> : null}
      </fieldset>
      <Input label="Business phone" value={phone} onChange={(e) => setPhone(e.target.value)} error={shown.phone} inputMode="tel" placeholder="0712 345 678" />
      <div className="flex flex-col gap-4">
        <Input label="Address" value={address} onChange={(e) => setAddress(e.target.value)} error={shown.address} placeholder="Street, area, town" />
        <div className="grid gap-4 sm:grid-cols-3">
          <Input label="Building" value={building} onChange={(e) => setBuilding(e.target.value)} placeholder="Optional" />
          <Input label="Floor" value={floor} onChange={(e) => setFloor(e.target.value)} placeholder="Optional" />
          <Input label="Shop / unit" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="Optional" />
        </div>
        <LocationPicker value={pin} onChange={setPin} />
        {shown.pin ? <p className="text-[13px] text-danger">{shown.pin}</p> : null}
      </div>
      <div className="flex justify-end">
        <Button type="submit" size="lg" loading={saving}>Save & continue</Button>
      </div>
    </form>
  );
}
