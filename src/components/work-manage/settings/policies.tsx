'use client';

import { useState } from 'react';
import { Input, Select, Switch } from '@/components/ui/field';
import { Card } from '@/components/ui/misc';
import { toast } from '@/components/ui/toast';
import { useWork } from '@/components/work/context';
import { api, errorMessage } from '@/lib/api';
import { cx, money } from '@/lib/format';
import type { BusinessPolicies } from '@/types/business';
import type { BusinessDetail } from '@/types/work-manage';
import { SectionTitle, digitsOnly } from '../shared';
import { SaveBar, SettingsSection } from './common';
import { useSetupStep } from '@/components/setup/context';

type Form = {
  required: boolean;
  type: 'fixed' | 'percent';
  amount: string;
  percent: string;
  appliesTo: 'all_services' | 'selected_services';
  serviceIds: string[];
  freeHours: string;
  lateFee: string;
  noShowFee: string;
};

function toForm(p: BusinessPolicies | null): Form {
  return {
    required: p?.deposit.required ?? false,
    type: p?.deposit.type ?? 'percent',
    amount: p?.deposit.amount ? String(p.deposit.amount.amount) : '',
    percent: p?.deposit.percent != null ? String(p.deposit.percent) : '20',
    appliesTo: p?.deposit.appliesTo ?? 'all_services',
    serviceIds: p?.deposit.serviceIds ?? [],
    freeHours: String(p?.cancellation.freeCancellationHours ?? 24),
    lateFee: String(p?.cancellation.lateFeePercent ?? 0),
    noShowFee: String(p?.noShow.feePercent ?? 0),
  };
}

export function PoliciesSettings() {
  return (
    <SettingsSection title="Policies" subtitle="Customers agree to these when they book.">
      {(b, reload) => <PoliciesForm business={b} reload={reload} />}
    </SettingsSection>
  );
}

function PoliciesForm({ business, reload }: { business: BusinessDetail; reload: () => void }) {
  const { businessId } = useWork();
  const initial = toForm(business.policies);
  const [form, setForm] = useState<Form>(initial);
  const [saving, setSaving] = useState(false);
  const setup = useSetupStep();
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));
  const dirty = JSON.stringify(form) !== JSON.stringify(initial);
  const services = business.serviceCategories.flatMap((c) => c.services.map((s) => ({ ...s, categoryName: c.name })));

  const pct = (v: string) => (v === '' || Number(v) > 100 ? 'Between 0 and 100.' : undefined);
  const errors = {
    amount: form.required && form.type === 'fixed' && !(Number(form.amount) > 0) ? 'Enter an amount above 0.' : undefined,
    percent: form.required && form.type === 'percent' && !(Number(form.percent) >= 1 && Number(form.percent) <= 100) ? 'Between 1 and 100.' : undefined,
    services: form.required && form.appliesTo === 'selected_services' && !form.serviceIds.length ? 'Pick at least one service.' : undefined,
    freeHours: form.freeHours === '' ? 'Enter hours (0 for none).' : undefined,
    lateFee: pct(form.lateFee),
    noShowFee: pct(form.noShowFee),
  };
  const invalid = Object.values(errors).some(Boolean);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (invalid) return;
    const body: BusinessPolicies = {
      deposit: {
        required: form.required,
        type: form.type,
        amount: form.type === 'fixed' && form.amount ? { amount: Number(form.amount), currency: 'KES' } : null,
        percent: form.type === 'percent' ? Number(form.percent) : null,
        appliesTo: form.appliesTo,
        serviceIds: form.appliesTo === 'selected_services' ? form.serviceIds : [],
      },
      cancellation: { freeCancellationHours: Number(form.freeHours), lateFeePercent: Number(form.lateFee) },
      noShow: { feePercent: Number(form.noShowFee) },
    };
    setSaving(true);
    try {
      await api(`/businesses/${businessId}/policies`, { method: 'PUT', body });
      toast.success('Policies saved');
      setup?.next(); // in the setup wizard: on to the next step
      reload();
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't save your policies."));
    } finally {
      setSaving(false);
    }
  };

  const example = 2000;
  const depositExample =
    form.type === 'percent' ? Math.round((example * (Number(form.percent) || 0)) / 100) : Number(form.amount) || 0;

  return (
    <form onSubmit={save} className="flex flex-col gap-6" noValidate>
      <Card>
        <SectionTitle
          title="Deposit"
          subtitle="Paid by M-Pesa when booking, so the slot is held."
          action={<Switch checked={form.required} onChange={(v) => set('required', v)} label="Require a deposit" />}
        />
        {form.required ? (
          <div className="flex flex-col gap-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Select label="Type" value={form.type} onChange={(e) => set('type', e.target.value as Form['type'])}>
                <option value="percent">Percent of the price</option>
                <option value="fixed">Fixed amount</option>
              </Select>
              {form.type === 'percent' ? (
                <Input label="Percent" inputMode="numeric" value={form.percent} onChange={(e) => set('percent', digitsOnly(e.target.value, 3))} error={errors.percent} />
              ) : (
                <Input label="Amount (KSh)" inputMode="numeric" value={form.amount} onChange={(e) => set('amount', digitsOnly(e.target.value, 7))} error={errors.amount} />
              )}
            </div>
            <p className="text-sm text-ink-2">
              E.g. on a {money(example)} booking the customer pays {money(Math.min(depositExample, example))} up front.
            </p>
            <div className="flex flex-col gap-3">
              <p className="text-sm font-semibold">Applies to</p>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Applies to">
                {(
                  [
                    ['all_services', 'All services'],
                    ['selected_services', 'Selected services'],
                  ] as const
                ).map(([v, l]) => (
                  <button
                    key={v}
                    type="button"
                    role="radio"
                    aria-checked={form.appliesTo === v}
                    onClick={() => set('appliesTo', v)}
                    className={cx('rounded-full px-4 py-2 text-sm font-semibold', form.appliesTo === v ? 'bg-ink text-white' : 'bg-surface-3')}
                  >
                    {l}
                  </button>
                ))}
              </div>
              {form.appliesTo === 'selected_services' ? (
                services.length ? (
                  <div className="grid max-h-72 gap-1 overflow-y-auto rounded-xl border border-line p-3 sm:grid-cols-2">
                    {services.map((s) => (
                      <label key={s.serviceId} className="flex items-center gap-3 py-1.5">
                        <input
                          type="checkbox"
                          className="size-4 accent-ink"
                          checked={form.serviceIds.includes(s.serviceId)}
                          onChange={(e) =>
                            set('serviceIds', e.target.checked ? [...form.serviceIds, s.serviceId] : form.serviceIds.filter((id) => id !== s.serviceId))
                          }
                        />
                        <span className="min-w-0 flex-1 truncate">{s.name}</span>
                        <span className="text-xs text-ink-3">{s.categoryName}</span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-ink-2">Add services first.</p>
                )
              ) : null}
              {errors.services ? <p className="text-[13px] text-danger">{errors.services}</p> : null}
            </div>
          </div>
        ) : (
          <p className="text-ink-2">No deposit: customers pay everything at the appointment.</p>
        )}
      </Card>

      <Card>
        <SectionTitle title="Cancellations" subtitle="A late cancellation fee comes out of the deposit; the rest is refunded." />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Free cancellation up to (hours before)"
            inputMode="numeric"
            value={form.freeHours}
            onChange={(e) => set('freeHours', digitsOnly(e.target.value, 4))}
            error={errors.freeHours}
          />
          <Input
            label="Late cancellation fee %"
            inputMode="numeric"
            value={form.lateFee}
            onChange={(e) => set('lateFee', digitsOnly(e.target.value, 3))}
            error={errors.lateFee}
            hint="Of the booking's total."
          />
        </div>
      </Card>

      <Card>
        <SectionTitle title="No-shows" subtitle="Only a paid deposit can be kept: any fee above it goes uncollected." />
        <Input
          label="No-show fee %"
          inputMode="numeric"
          value={form.noShowFee}
          onChange={(e) => set('noShowFee', digitsOnly(e.target.value, 3))}
          error={errors.noShowFee}
          hint="Of the booking's total."
          className="sm:max-w-xs"
        />
      </Card>

      <SaveBar dirty={dirty} saving={saving} disabled={invalid} onReset={() => setForm(initial)} />
    </form>
  );
}
