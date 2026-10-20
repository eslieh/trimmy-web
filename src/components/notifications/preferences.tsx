'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Spinner } from '@/components/ui/button';
import { Switch } from '@/components/ui/field';
import { Card, EmptyState, PageHeader } from '@/components/ui/misc';
import { toast } from '@/components/ui/toast';
import { useSession } from '@/components/session';
import { api, errorMessage } from '@/lib/api';

type Channel = 'push' | 'sms' | 'email';
type Switches = Record<Channel, boolean>;
type Category = 'bookings' | 'reminders' | 'business' | 'payouts' | 'team';
type ReminderTiming = 'dayBefore' | 'twoHoursBefore';

type Prefs = {
  reminders: { dayBefore: boolean; twoHoursBefore: boolean; sms: boolean; push: boolean; email: boolean };
  categories: Partial<Record<Category, Switches>>;
  availableChannels: Switches;
};

type Patch = {
  reminders?: Partial<Record<ReminderTiming, boolean>>;
  categories?: Partial<Record<Category, Partial<Switches>>>;
};

const CATEGORY_COPY: Record<Category, { title: string; hint: string }> = {
  bookings: { title: 'Your bookings', hint: 'Confirmations, changes, cancellations and receipts' },
  reminders: { title: 'Reminders', hint: 'Before each appointment' },
  business: { title: 'Business', hint: 'New bookings, cancellations and assignments where you work' },
  payouts: { title: 'Payouts & wallet', hint: 'Payout requests, answers and wallet changes' },
  team: { title: 'Team invitations', hint: 'When a business invites you to join' },
};
const ORDER: Category[] = ['bookings', 'reminders', 'business', 'payouts', 'team'];
const CHANNEL_LABEL: Record<Channel, string> = { push: 'Push', sms: 'SMS', email: 'Email' };

function applyPatch(p: Prefs, patch: Patch): Prefs {
  const categories = { ...p.categories };
  for (const [c, sw] of Object.entries(patch.categories ?? {}) as [Category, Partial<Switches>][]) {
    const before = categories[c];
    if (before) categories[c] = { ...before, ...sw };
  }
  return { ...p, reminders: { ...p.reminders, ...patch.reminders }, categories };
}

// The opposite of a one-switch patch, to put just that switch back.
function invert(patch: Patch): Patch {
  const flip = <T extends string>(o?: Partial<Record<T, boolean>>) =>
    o ? (Object.fromEntries(Object.entries(o).map(([k, v]) => [k, !v])) as Partial<Record<T, boolean>>) : undefined;
  return {
    reminders: flip(patch.reminders),
    categories: patch.categories
      ? (Object.fromEntries(Object.entries(patch.categories).map(([c, sw]) => [c, flip(sw)])) as Patch['categories'])
      : undefined,
  };
}

// Everything always shows in the inbox; this picks the extra channels per
// category, and which reminders. The server says which categories apply and
// which channels can reach this person; only those are shown (push stays
// hidden until it's switched on for Trimmy). Each switch saves straight away
// and flips back on its own if that save fails.
export function NotificationPreferences() {
  const { session } = useSession();
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [loadError, setLoadError] = useState('');
  const pending = useRef(0);

  useEffect(() => {
    let cancelled = false;
    api<Prefs>('/me/notification-preferences')
      .then((p) => !cancelled && setPrefs(p))
      .catch((err) => !cancelled && setLoadError(errorMessage(err, "Couldn't load your settings.")));
    return () => {
      cancelled = true;
    };
  }, []);

  const save = (patch: Patch) => {
    setPrefs((p) => (p ? applyPatch(p, patch) : p));
    pending.current += 1;
    api<Prefs>('/me/notification-preferences', { method: 'PATCH', body: patch })
      .then((server) => {
        // Only the last save in a quick run of taps may overwrite what's on
        // screen; earlier answers don't know about the later taps yet.
        if (pending.current === 1) setPrefs(server);
      })
      .catch((err) => {
        setPrefs((p) => (p ? applyPatch(p, invert(patch)) : p));
        toast.error(errorMessage(err, "Couldn't save that change."));
      })
      .finally(() => {
        pending.current -= 1;
      });
  };

  if (loadError) {
    return (
      <Shell>
        <EmptyState title="Couldn't load your settings" body={loadError} />
      </Shell>
    );
  }
  if (!prefs) {
    return (
      <Shell>
        <div className="grid place-items-center py-16 text-ink-3"><Spinner /></div>
      </Shell>
    );
  }

  const channels = (['push', 'sms', 'email'] as Channel[]).filter((c) => prefs.availableChannels[c]);
  const categories = ORDER.filter((c) => prefs.categories[c]);
  const user = session?.user;
  const missing = [
    !prefs.availableChannels.sms && user && !user.phone ? 'a phone number to get texts' : null,
    !prefs.availableChannels.email && user && !user.email ? 'an email address to get emails' : null,
  ].filter(Boolean);

  return (
    <Shell>
      <p className="mb-5 text-ink-2">Everything always shows in your Trimmy notifications. Choose where else you hear about it.</p>

      {channels.length === 0 ? (
        <Card className="mb-5">
          <p className="text-ink-2">Texts and emails aren&apos;t available for your account right now, so everything arrives in your notifications here.</p>
        </Card>
      ) : (
        <Card className="mb-5 p-0">
          <div className="flex items-center gap-3 border-b border-line px-5 py-3 text-xs font-bold text-ink-2 uppercase">
            <span className="flex-1">Notify me about</span>
            {channels.map((c) => (
              <span key={c} className="w-12 text-center">{CHANNEL_LABEL[c]}</span>
            ))}
          </div>
          <ul>
            {categories.map((category) => {
              const switches = prefs.categories[category]!;
              return (
                <li key={category} className="flex items-center gap-3 border-b border-line px-5 py-4 last:border-b-0">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{CATEGORY_COPY[category].title}</p>
                    <p className="text-[13px] text-ink-2">{CATEGORY_COPY[category].hint}</p>
                  </div>
                  {channels.map((c) => (
                    <span key={c} className="flex w-12 justify-center">
                      <Switch
                        label={`${CATEGORY_COPY[category].title}: ${CHANNEL_LABEL[c]}`}
                        checked={switches[c]}
                        onChange={(v) => save({ categories: { [category]: { [c]: v } } })}
                      />
                    </span>
                  ))}
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {missing.length ? (
        <p className="mb-5 text-sm text-ink-2">
          Add {missing.join(' and ')} in{' '}
          <Link href="/account/details" className="font-semibold text-ink underline">your details</Link>.
        </p>
      ) : null}

      {prefs.categories.reminders ? (
        <Card className="p-0">
          <div className="border-b border-line px-5 py-3">
            <p className="font-bold">Reminder timing</p>
            <p className="text-[13px] text-ink-2">Which reminders to send before each appointment</p>
          </div>
          <TimingRow label="Day before" checked={prefs.reminders.dayBefore} onChange={(v) => save({ reminders: { dayBefore: v } })} />
          <TimingRow
            label="2 hours before"
            hint="With directions to the business"
            checked={prefs.reminders.twoHoursBefore}
            onChange={(v) => save({ reminders: { twoHoursBefore: v } })}
          />
        </Card>
      ) : null}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/account" className="mb-3 inline-block text-sm font-semibold text-ink-2 hover:text-ink">← Account</Link>
      <PageHeader title="Notification settings" />
      {children}
    </div>
  );
}

function TimingRow({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center gap-3 border-b border-line px-5 py-4 last:border-b-0">
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{label}</p>
        {hint ? <p className="text-[13px] text-ink-2">{hint}</p> : null}
      </div>
      <Switch label={label} checked={checked} onChange={onChange} />
    </div>
  );
}
