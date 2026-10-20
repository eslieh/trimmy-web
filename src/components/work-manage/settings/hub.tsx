'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Badge, Card } from '@/components/ui/misc';
import { toast } from '@/components/ui/toast';
import { useWork, workHref } from '@/components/work/context';
import { api, errorMessage } from '@/lib/api';
import { cx, money, timeLabel } from '@/lib/format';
import type { TeamMode } from '@/types/business';
import type { BusinessDetail, PublishResult } from '@/types/work-manage';
import { ConfirmModal, WEEKDAYS } from '../shared';
import { SETTINGS_SECTIONS, SettingsSection } from './common';

export function SettingsHub() {
  return (
    <SettingsSection title="Settings" subtitle="How your business appears and how customers book it.">
      {(b, reload) => <Hub business={b} reload={reload} />}
    </SettingsSection>
  );
}

function summary(b: BusinessDetail, key: string): string {
  switch (key) {
    case 'info':
      return b.location?.address || b.name;
    case 'photos':
      return `${b.photos?.length ?? 0} ${b.photos?.length === 1 ? 'photo' : 'photos'}`;
    case 'services': {
      const n = b.serviceCategories.reduce((s, c) => s + c.services.length, 0);
      return `${n} ${n === 1 ? 'service' : 'services'} in ${b.serviceCategories.length} ${b.serviceCategories.length === 1 ? 'category' : 'categories'}`;
    }
    case 'hours': {
      const w = b.workingHours?.weeklyHours;
      if (!w) return 'Not set';
      const open = WEEKDAYS.filter((d) => w[d.key]);
      if (!open.length) return 'Closed every day';
      const first = w[open[0].key]!;
      return `Open ${open.length} ${open.length === 1 ? 'day' : 'days'} · e.g. ${open[0].short} ${timeLabel(first.open)}–${first.close === '24:00' ? 'midnight' : timeLabel(first.close)}`;
    }
    case 'booking-rules': {
      const s = b.bookingSettings;
      return s ? `Every ${s.slotIntervalMinutes} min · up to ${s.maxDaysAhead} days ahead` : 'Defaults';
    }
    case 'policies': {
      const d = b.policies?.deposit;
      if (!b.policies) return 'Not set';
      if (!d?.required) return 'No deposit';
      return d.type === 'percent' ? `${d.percent}% deposit` : `${money(d.amount)} deposit`;
    }
    case 'payment': {
      const p = b.paymentDestination;
      if (!p) return 'Not set';
      if (p.type === 'mpesa_till') return `M-Pesa till ${p.tillNumber}`;
      if (p.type === 'mpesa_paybill') return `Paybill ${p.paybillNumber} · ${p.paybillAccountNumber}`;
      return `${p.bankName} · ${p.bankAccountNumber}`;
    }
    default:
      return '';
  }
}

function Hub({ business, reload }: { business: BusinessDetail; reload: () => void }) {
  const { businessId } = useWork();
  const router = useRouter();
  const [publishing, setPublishing] = useState(false);
  const [confirmHide, setConfirmHide] = useState(false);
  const [modeSaving, setModeSaving] = useState(false);
  const published = business.status === 'published';

  const setVisible = async (visible: boolean) => {
    setPublishing(true);
    try {
      await api<PublishResult>(`/businesses/${businessId}/publish`, { method: 'PATCH', body: { visible } });
      toast.success(visible ? 'Your business is live' : 'Your business is hidden from customers');
      setConfirmHide(false);
      reload();
    } catch (err) {
      toast.error(errorMessage(err, visible ? "Couldn't publish." : "Couldn't unpublish."));
    } finally {
      setPublishing(false);
    }
  };

  const setMode = async (teamMode: TeamMode) => {
    if (teamMode === business.teamMode) return;
    setModeSaving(true);
    try {
      await api(`/businesses/${businessId}/team-mode`, { method: 'PATCH', body: { teamMode } });
      toast.success(teamMode === 'team' ? 'Team mode on' : 'Solo mode on');
      reload();
      // Going solo can give the owner a staff record: refresh the layout's session.
      router.refresh();
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't change it."));
    } finally {
      setModeSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-bold">Visibility</p>
              <p className="mt-1 text-sm text-ink-2">
                {published ? 'Customers can find and book you on Trimmy.' : 'Hidden: customers can’t find or book you.'}
              </p>
            </div>
            <Badge tone={published ? 'success' : 'neutral'}>{published ? 'Live' : 'Draft'}</Badge>
          </div>
          <div className="mt-4">
            {published ? (
              <button className="text-sm font-semibold text-danger hover:underline" onClick={() => setConfirmHide(true)}>
                Unpublish
              </button>
            ) : (
              <button
                className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-black disabled:opacity-50"
                onClick={() => setVisible(true)}
                disabled={publishing}
              >
                {publishing ? 'Publishing…' : 'Publish'}
              </button>
            )}
          </div>
        </Card>
        <Card>
          <p className="font-bold">Who takes clients</p>
          <p className="mt-1 text-sm text-ink-2">Solo: you take every booking yourself. Team: your staff take bookings, managed from Team.</p>
          <div role="radiogroup" aria-label="Team mode" className="mt-4 inline-flex rounded-full bg-surface-3 p-1">
            {(['solo', 'team'] as const).map((m) => (
              <button
                key={m}
                role="radio"
                aria-checked={business.teamMode === m}
                disabled={modeSaving}
                onClick={() => setMode(m)}
                className={cx(
                  'rounded-full px-5 py-1.5 text-sm font-semibold transition-colors disabled:opacity-60',
                  business.teamMode === m ? 'bg-white shadow-card' : 'text-ink-2 hover:text-ink',
                )}
              >
                {m === 'solo' ? 'Solo' : 'Team'}
              </button>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {SETTINGS_SECTIONS.map((s) => (
          <Link
            key={s.href}
            href={workHref(businessId, `settings/${s.href}`)}
            className="group rounded-card border border-line bg-white p-5 shadow-card transition-shadow hover:shadow-raised"
          >
            <p className="flex items-center justify-between font-bold">
              {s.label}
              <span aria-hidden className="text-ink-3 transition-transform group-hover:translate-x-0.5">→</span>
            </p>
            <p className="mt-1 text-sm text-ink-2">{s.blurb}</p>
            <p className="mt-3 truncate text-sm font-semibold">{summary(business, s.href)}</p>
          </Link>
        ))}
      </div>

      <ConfirmModal
        open={confirmHide}
        onClose={() => setConfirmHide(false)}
        title="Unpublish your business?"
        body="Customers won't find you or be able to book until you publish again. Existing bookings stay as they are."
        confirmLabel="Unpublish"
        danger
        onConfirm={() => setVisible(false)}
      />
    </div>
  );
}
