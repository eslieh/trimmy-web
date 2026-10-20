'use client';

import { useState } from 'react';
import { Input, Select } from '@/components/ui/field';
import { Badge, Card } from '@/components/ui/misc';
import { toast } from '@/components/ui/toast';
import { useWork } from '@/components/work/context';
import { api, errorMessage } from '@/lib/api';
import { cx } from '@/lib/format';
import type { PaymentDestination, PaymentDestinationOptions, PaymentFieldOption } from '@/types/business';
import type { BusinessDetail } from '@/types/work-manage';
import { ErrorBlock, Loading, SectionTitle } from '../shared';
import { useApi } from '../use-api';
import { SaveBar, SettingsSection } from './common';
import { useSetupStep } from '@/components/setup/context';

type FieldName = PaymentFieldOption['name'];
type Values = Partial<Record<FieldName, string>>;
const OTHER_BANK = '__other__';

export function PaymentSettings() {
  const options = useApi<PaymentDestinationOptions>('/payment-destinations/options');
  return (
    <SettingsSection title="Payment details" subtitle="Where customers' deposits and payments go. Straight to you: Trimmy never holds the money.">
      {(b, reload) =>
        options.data ? (
          <PaymentForm business={b} reload={reload} options={options.data} />
        ) : options.error ? (
          <ErrorBlock message={options.error} onRetry={options.reload} />
        ) : (
          <Loading />
        )
      }
    </SettingsSection>
  );
}

function fromDestination(d: PaymentDestination | null): Values {
  if (!d) return {};
  const { tillNumber, paybillNumber, paybillAccountNumber, bankName, bankShortcode, bankAccountNumber } = d;
  return Object.fromEntries(
    Object.entries({ tillNumber, paybillNumber, paybillAccountNumber, bankName, bankShortcode, bankAccountNumber }).filter(([, v]) => v),
  ) as Values;
}

function PaymentForm({ business, reload, options }: { business: BusinessDetail; reload: () => void; options: PaymentDestinationOptions }) {
  const { businessId } = useWork();
  const current = business.paymentDestination;
  const initialType = current?.type ?? options.types[0]?.type ?? 'mpesa_till';
  const initialValues = fromDestination(current);
  const [type, setType] = useState<PaymentDestination['type']>(initialType);
  const [values, setValues] = useState<Values>(initialValues);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const setup = useSetupStep();

  const option = options.types.find((t) => t.type === type) ?? options.types[0];
  const fields = option?.fields ?? [];
  const value = (n: FieldName) => values[n] ?? '';
  const set = (n: FieldName, v: string) => setValues((s) => ({ ...s, [n]: v }));
  // The server's patterns are JS-compatible; trimmed values are what's sent.
  const errorFor = (f: PaymentFieldOption) => (new RegExp(f.pattern).test(value(f.name).trim()) ? undefined : f.hint);
  const invalid = fields.some((f) => errorFor(f));
  const dirty = type !== initialType || fields.some((f) => value(f.name) !== (initialValues[f.name] ?? ''));

  const bankKnown = options.banks.some((b) => b.name === values.bankName);
  const [otherBank, setOtherBank] = useState(!!current?.bankName && !options.banks.some((b) => b.name === current.bankName));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (invalid) return;
    const body: Record<string, string> = { type };
    for (const f of fields) body[f.name] = value(f.name).trim();
    setSaving(true);
    try {
      const saved = await api<PaymentDestination>(`/businesses/${businessId}/payment-destination`, { method: 'PUT', body });
      toast.success(saved.verificationStatus === 'verified' ? 'Payment details saved' : 'Saved: we are checking these details');
      setup?.next(); // in the setup wizard: on to the next step
      setSubmitted(false);
      reload();
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't save your payment details."));
    } finally {
      setSaving(false);
    }
  };

  const status = current?.verificationStatus;
  return (
    <form onSubmit={save} className="flex flex-col gap-6" noValidate>
      {current ? (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-ink-2">Current details:</span>
          <Badge tone={status === 'verified' ? 'success' : status === 'failed' ? 'danger' : 'warning'}>
            {status === 'verified' ? 'Verified' : status === 'failed' ? 'Failed checks' : 'Being checked'}
          </Badge>
        </div>
      ) : null}
      <div role="radiogroup" aria-label="Payment method" className="grid gap-3 md:grid-cols-3">
        {options.types.map((t) => (
          <button
            key={t.type}
            type="button"
            role="radio"
            aria-checked={type === t.type}
            onClick={() => setType(t.type)}
            className={cx(
              'rounded-card border p-4 text-left transition-colors',
              type === t.type ? 'border-ink ring-1 ring-ink' : 'border-line-2 bg-white hover:border-ink',
            )}
          >
            <p className="font-bold">{t.label}</p>
            <p className="mt-1 text-sm text-ink-2">{t.description}</p>
          </button>
        ))}
      </div>

      <Card>
        <SectionTitle title={option?.label ?? 'Details'} />
        <div className="grid gap-4 sm:grid-cols-2">
          {fields.map((f) => {
            const error = submitted ? errorFor(f) : undefined;
            if (f.keyboard === 'picker' && f.name === 'bankName') {
              return (
                <div key={f.name} className="flex flex-col gap-3">
                  <Select
                    label={f.label}
                    value={otherBank ? OTHER_BANK : bankKnown ? value('bankName') : ''}
                    error={!otherBank ? error : undefined}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === OTHER_BANK) {
                        setOtherBank(true);
                        set('bankName', '');
                        return;
                      }
                      setOtherBank(false);
                      const bank = options.banks.find((b) => b.name === v);
                      // Picking a bank fills its M-Pesa paybill.
                      setValues((s) => ({ ...s, bankName: v, bankShortcode: bank?.shortcode ?? s.bankShortcode }));
                    }}
                  >
                    <option value="" disabled>
                      Choose your bank
                    </option>
                    {options.banks.map((b) => (
                      <option key={b.name} value={b.name}>
                        {b.name}
                      </option>
                    ))}
                    <option value={OTHER_BANK}>Another bank…</option>
                  </Select>
                  {otherBank ? <Input label="Bank name" value={value('bankName')} onChange={(e) => set('bankName', e.target.value)} error={error} /> : null}
                </div>
              );
            }
            // M-Pesa account references are at most 20 characters.
            const max = f.name === 'paybillAccountNumber' || f.name === 'bankAccountNumber' ? 20 : f.keyboard === 'number' ? 7 : undefined;
            return (
              <Input
                key={f.name}
                label={f.label}
                value={value(f.name)}
                inputMode={f.keyboard === 'number' ? 'numeric' : undefined}
                maxLength={max}
                onChange={(e) => set(f.name, f.keyboard === 'number' ? e.target.value.replace(/\D/g, '') : e.target.value)}
                error={error}
                hint={f.hint}
              />
            );
          })}
        </div>
      </Card>
      <SaveBar dirty={dirty} saving={saving} onReset={() => {
        setType(initialType);
        setValues(initialValues);
        setSubmitted(false);
      }} />
    </form>
  );
}
