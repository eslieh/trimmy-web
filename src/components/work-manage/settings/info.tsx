'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/field';
import { Card } from '@/components/ui/misc';
import { toast } from '@/components/ui/toast';
import { useWork } from '@/components/work/context';
import { api, errorMessage } from '@/lib/api';
import { cx } from '@/lib/format';
import type { BusinessCategory } from '@/types/business';
import type { BusinessDetail, UpdateBusinessInfoInput } from '@/types/work-manage';
import { SectionTitle } from '../shared';
import { AMENITIES, BUSINESS_CATEGORIES, SaveBar, SettingsSection } from './common';
import { LocationPicker } from '@/components/map/location-picker';
import { NAIROBI } from '@/components/map/map';
import { useSetupStep } from '@/components/setup/context';


type Form = {
  name: string;
  description: string;
  categories: BusinessCategory[];
  phone: string;
  address: string;
  building: string;
  floor: string;
  unit: string;
  pin: { lat: number; lng: number } | null;
  amenities: string[];
};

function toForm(b: BusinessDetail): Form {
  return {
    name: b.name,
    description: b.description ?? '',
    categories: b.categories ?? [],
    phone: b.phone,
    address: b.location?.address ?? '',
    building: b.location?.building ?? '',
    floor: b.location?.floor ?? '',
    unit: b.location?.unit ?? '',
    pin: b.location && typeof b.location.lat === 'number' ? { lat: b.location.lat, lng: b.location.lng } : null,
    amenities: b.amenities ?? [],
  };
}

export function InfoSettings() {
  return (
    <SettingsSection title="Business info" subtitle="Shown on your Trimmy profile.">
      {(b, reload) => <InfoForm business={b} reload={reload} />}
    </SettingsSection>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cx(
        'rounded-full border px-4 py-2 text-sm font-semibold transition-colors',
        on ? 'border-ink bg-ink text-white' : 'border-line-2 bg-white hover:border-ink',
      )}
    >
      {children}
    </button>
  );
}

function InfoForm({ business, reload }: { business: BusinessDetail; reload: () => void }) {
  const { businessId } = useWork();
  const initial = toForm(business);
  const [form, setForm] = useState<Form>(initial);
  const [custom, setCustom] = useState('');
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const setup = useSetupStep();
  const [submitted, setSubmitted] = useState(false);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));
  const dirty = JSON.stringify(form) !== JSON.stringify(initial);

  const errors = {
    name: !form.name.trim() ? 'Enter your business name.' : undefined,
    categories: !form.categories.length ? 'Pick at least one.' : undefined,
    phone: !form.phone.trim() ? 'Enter a phone number customers can call.' : undefined,
    address: !form.address.trim() ? 'Enter your address.' : undefined,
  };
  const invalid = Object.values(errors).some(Boolean);
  const shown: Partial<typeof errors> = submitted ? errors : {};

  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const allAmenities = [...AMENITIES, ...form.amenities.filter((a) => !AMENITIES.includes(a))];

  const addCustom = () => {
    const v = custom.trim();
    if (v && !form.amenities.includes(v)) set('amenities', [...form.amenities, v]);
    setCustom('');
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (invalid) return;
    const pin = form.pin ?? NAIROBI;
    const body: UpdateBusinessInfoInput = {
      name: form.name.trim(),
      description: form.description.trim(),
      categories: form.categories,
      phone: form.phone.trim(),
      location: {
        address: form.address.trim(),
        lat: pin.lat,
        lng: pin.lng,
        building: form.building.trim() || undefined,
        floor: form.floor.trim() || undefined,
        unit: form.unit.trim() || undefined,
      },
      amenities: form.amenities,
    };
    setSaving(true);
    try {
      await api(`/businesses/${businessId}`, { method: 'PATCH', body });
      toast.success('Business info saved');
      setup?.next(); // in the setup wizard: on to the next step
      setSubmitted(false);
      reload();
      router.refresh(); // the sidebar and header show the business name from the session
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't save."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={save} className="flex flex-col gap-6" noValidate>
      <Card>
        <SectionTitle title="About" />
        <div className="flex flex-col gap-4">
          <Input label="Business name" value={form.name} onChange={(e) => set('name', e.target.value)} error={shown.name} maxLength={200} />
          <Textarea
            label="Description"
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
            hint="What you're known for, who you serve, what makes a visit special."
            rows={4}
          />
          <div className="flex flex-col gap-2">
            <p className="text-sm font-semibold">Categories</p>
            <div className="flex flex-wrap gap-2">
              {BUSINESS_CATEGORIES.map((c) => (
                <Chip key={c.value} on={form.categories.includes(c.value)} onClick={() => set('categories', toggle(form.categories, c.value))}>
                  {c.label}
                </Chip>
              ))}
            </div>
            {shown.categories ? <p className="text-[13px] text-danger">{shown.categories}</p> : null}
          </div>
          <Input label="Phone" type="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} error={shown.phone} className="sm:max-w-sm" />
        </div>
      </Card>

      <Card>
        <SectionTitle title="Location" subtitle="Help customers find the door: a map pin alone doesn't say which floor or shop." />
        <div className="flex flex-col gap-4">
          <Input label="Address" value={form.address} onChange={(e) => set('address', e.target.value)} error={shown.address} />
          <div className="grid gap-4 sm:grid-cols-3">
            <Input label="Building" value={form.building} onChange={(e) => set('building', e.target.value)} placeholder="e.g. Sarit Centre" />
            <Input label="Floor" value={form.floor} onChange={(e) => set('floor', e.target.value)} placeholder="e.g. 2nd" />
            <Input label="Shop / unit" value={form.unit} onChange={(e) => set('unit', e.target.value)} placeholder="e.g. B14" />
          </div>
          <LocationPicker value={form.pin} onChange={(pos) => set('pin', pos)} />
        </div>
      </Card>

      <Card>
        <SectionTitle title="Amenities" />
        <div className="flex flex-wrap gap-2">
          {allAmenities.map((a) => (
            <Chip key={a} on={form.amenities.includes(a)} onClick={() => set('amenities', toggle(form.amenities, a))}>
              {a}
            </Chip>
          ))}
        </div>
        <div className="mt-4 flex items-end gap-2">
          <Input
            label="Add your own"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addCustom();
              }
            }}
            maxLength={40}
            className="flex-1 sm:max-w-sm"
          />
          <Button type="button" variant="secondary" onClick={addCustom} disabled={!custom.trim()}>
            Add
          </Button>
        </div>
      </Card>

      <SaveBar dirty={dirty} saving={saving} onReset={() => setForm(initial)} />
    </form>
  );
}
