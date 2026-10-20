'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useSession } from '@/components/session';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/ui/misc';
import { toast } from '@/components/ui/toast';
import { HoursSettings } from '@/components/work-manage/settings/hours';
import { InfoSettings } from '@/components/work-manage/settings/info';
import { PaymentSettings } from '@/components/work-manage/settings/payment';
import { PhotosSettings } from '@/components/work-manage/settings/photos';
import { PoliciesSettings } from '@/components/work-manage/settings/policies';
import { ServicesSettings } from '@/components/work-manage/settings/services';
import { useBusiness } from '@/components/work-manage/settings/common';
import { useWork } from '@/components/work/context';
import { ApiError, api, errorMessage } from '@/lib/api';
import { cx } from '@/lib/format';
import type { TeamMode } from '@/types/business';
import type { BusinessDetail } from '@/types/work-manage';
import { SetupStepProvider } from './context';
import { SETUP_STEPS, nextStep, previousStep, type SetupStepKey } from './steps';

// The wizard's frame: the wordmark, progress, and "Save and exit".
export function SetupShell({ step, children }: { step: SetupStepKey | 'basics'; children: React.ReactNode }) {
  const index = SETUP_STEPS.findIndex((s) => s.key === step);
  return (
    <div className="min-h-dvh bg-surface-2/60">
      <header className="sticky top-0 z-30 border-b border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-4xl items-center gap-4 px-4 sm:px-6">
          <Logo height={24} />
          <p className="hidden text-sm font-semibold text-ink-2 sm:block">Set up your business</p>
          <Link href="/" className="ml-auto text-sm font-semibold text-ink-2 hover:text-ink">
            Save and exit
          </Link>
        </div>
        <div className="mx-auto max-w-4xl px-4 pb-3 sm:px-6">
          <div className="flex items-center justify-between text-xs font-semibold text-ink-3">
            <span>
              Step {index + 1} of {SETUP_STEPS.length}: {SETUP_STEPS[index]?.label}
            </span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuemin={1} aria-valuemax={SETUP_STEPS.length} aria-valuenow={index + 1}>
            <div className="h-full rounded-full bg-brand-gradient transition-all" style={{ width: `${((index + 1) / SETUP_STEPS.length) * 100}%` }} />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <div className="rounded-sheet border border-line bg-white p-5 shadow-card sm:p-8">{children}</div>
      </main>
    </div>
  );
}

// One step of setup for an existing draft. Most steps are the business
// settings forms, which save-and-continue inside the wizard (SetupStepProvider).
export function SetupStepView({ businessId, step }: { businessId: string; step: SetupStepKey }) {
  const router = useRouter();
  const go = (to: SetupStepKey) => router.push(`/setup/${businessId}/${to}`);
  const back = previousStep(step);

  return (
    <SetupShell step={step}>
      <SetupStepProvider value={{ next: () => go(nextStep(step)) }}>
        {step === 'basics' ? <InfoSettings /> : null}
        {step === 'photos' ? (
          <>
            <PhotosSettings />
            <GatedContinue need="photos" onContinue={() => go('hours')} />
          </>
        ) : null}
        {step === 'hours' ? <HoursSettings /> : null}
        {step === 'services' ? (
          <>
            <ServicesSettings />
            <GatedContinue need="services" onContinue={() => go('policies')} />
          </>
        ) : null}
        {step === 'policies' ? <PoliciesSettings /> : null}
        {step === 'payment' ? <PaymentSettings /> : null}
        {step === 'team' ? <TeamModeStep onDone={() => go('review')} /> : null}
        {step === 'review' ? <ReviewStep businessId={businessId} onEdit={go} /> : null}
      </SetupStepProvider>
      {back ? (
        <button onClick={() => go(back)} className="mt-6 text-sm font-semibold text-ink-2 hover:text-ink">
          ← Back
        </button>
      ) : null}
    </SetupShell>
  );
}

// Photos and services save as you go, so their step just needs a Continue,
// which needs at least one of each first (as in the app).
function GatedContinue({ need, onContinue }: { need: 'photos' | 'services'; onContinue: () => void }) {
  const { reload } = useBusiness();
  const { businessId } = useWork();
  const [checking, setChecking] = useState(false);
  const check = async () => {
    setChecking(true);
    try {
      // Fresh from the server: the form above saved on its own.
      const b = await api<BusinessDetail>(`/businesses/${businessId}`);
      const count = need === 'photos' ? b.photos?.length ?? 0 : b.serviceCategories.reduce((n, c) => n + (c.services?.length ?? 0), 0);
      if (!count) {
        toast.error(need === 'photos' ? 'Add at least one photo first' : 'Add at least one service first');
        reload();
        return;
      }
      onContinue();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setChecking(false);
    }
  };
  return (
    <div className="sticky bottom-0 -mx-5 mt-6 flex justify-end border-t border-line bg-white/95 px-5 py-3 backdrop-blur sm:-mx-8 sm:px-8">
      <Button onClick={check} loading={checking}>Continue</Button>
    </div>
  );
}

function TeamModeStep({ onDone }: { onDone: () => void }) {
  const { data, reload } = useBusiness();
  const [choice, setChoice] = useState<TeamMode | null>(null);
  const [saving, setSaving] = useState(false);
  const selected = choice ?? data?.teamMode ?? null;
  const businessId = data?.businessId;

  const save = async () => {
    if (!selected || !businessId) return;
    setSaving(true);
    try {
      await api(`/businesses/${businessId}/team-mode`, { method: 'PATCH', body: { teamMode: selected } });
      onDone();
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't save that."));
      reload();
      setSaving(false);
    }
  };

  const card = (mode: TeamMode, title: string, body: string) => (
    <button
      type="button"
      aria-pressed={selected === mode}
      onClick={() => setChoice(mode)}
      className={cx(
        'flex flex-col gap-1 rounded-card border-2 p-5 text-left transition-colors',
        selected === mode ? 'border-ink bg-surface-2' : 'border-line hover:border-line-3',
      )}
    >
      <span className="text-lg font-bold">{title}</span>
      <span className="text-ink-2">{body}</span>
    </button>
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Do you work alone or with a team?</h1>
        <p className="mt-1 text-ink-2">This sets up your calendar. You can change it later in Settings.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {card('solo', 'Just me', "You take every appointment yourself. Customers book you directly.")}
        {card('team', 'I have a team', 'Staff take appointments, and you can add a front desk. Invite them from Team once you are live.')}
      </div>
      <div className="flex justify-end">
        <Button onClick={save} disabled={!selected} loading={saving}>Save & continue</Button>
      </div>
    </div>
  );
}

function ReviewStep({ businessId, onEdit }: { businessId: string; onEdit: (step: SetupStepKey) => void }) {
  const router = useRouter();
  const { refresh } = useSession();
  const { data: b } = useBusiness();
  const [publishing, setPublishing] = useState(false);

  if (!b) return <p className="text-ink-2">Loading your business…</p>;

  const services = b.serviceCategories.reduce((n, c) => n + (c.services?.length ?? 0), 0);
  const openDays = b.workingHours ? Object.values(b.workingHours.weeklyHours).filter(Boolean).length : 0;
  const checks: { step: SetupStepKey; label: string; ok: boolean; detail: string }[] = [
    { step: 'basics', label: 'Basics', ok: Boolean(b.name && b.location), detail: b.location?.address ?? 'No address yet' },
    { step: 'photos', label: 'Photos', ok: (b.photos?.length ?? 0) > 0, detail: `${b.photos?.length ?? 0} photo(s)` },
    { step: 'hours', label: 'Working hours', ok: openDays > 0, detail: openDays ? `Open ${openDays} day(s) a week` : 'Not set' },
    { step: 'services', label: 'Services', ok: services > 0, detail: `${services} service(s)` },
    { step: 'policies', label: 'Policies', ok: Boolean(b.policies), detail: b.policies?.deposit?.required ? 'Deposit required' : b.policies ? 'No deposit' : 'Not set' },
    {
      step: 'payment', label: 'Payment details',
      ok: b.paymentDestination?.verificationStatus === 'verified',
      detail: b.paymentDestination ? (b.paymentDestination.verificationStatus === 'verified' ? 'Ready for M-Pesa' : 'Being checked') : 'Not set',
    },
    { step: 'team', label: 'Solo or team', ok: Boolean(b.teamMode), detail: b.teamMode === 'team' ? 'With a team' : b.teamMode === 'solo' ? 'Just me' : 'Not set' },
  ];
  const ready = checks.every((c) => c.ok);

  const publish = async () => {
    setPublishing(true);
    try {
      await api(`/businesses/${businessId}/publish`, { method: 'PATCH', body: { visible: true } });
      toast.success(`${b.name} is live on Trimmy`);
      refresh(); // now a published workplace
      router.push(`/work/${businessId}/today`);
    } catch (err) {
      toast.error(err instanceof ApiError && err.code === 'incomplete_setup' ? err.message : errorMessage(err, "Couldn't publish."));
      setPublishing(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Review and go live</h1>
        <p className="mt-1 text-ink-2">Customers can find and book {b.name} as soon as you publish.</p>
      </div>
      <ul className="divide-y divide-line rounded-card border border-line">
        {checks.map((c) => (
          <li key={c.step} className="flex items-center gap-3 px-4 py-3">
            <span className={cx('grid size-6 shrink-0 place-items-center rounded-full text-xs font-bold text-white', c.ok ? 'bg-success' : 'bg-line-3')} aria-hidden>
              {c.ok ? '✓' : '!'}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{c.label}</p>
              <p className="truncate text-sm text-ink-2">{c.detail}</p>
            </div>
            <button onClick={() => onEdit(c.step)} className="text-sm font-semibold text-brand hover:underline">Edit</button>
          </li>
        ))}
      </ul>
      {!ready ? <p className="text-sm text-ink-2">Finish the steps marked ! to publish. Your progress is saved.</p> : null}
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="secondary" onClick={() => router.push('/')}>Save as draft</Button>
        <Button variant="brand" onClick={publish} disabled={!ready} loading={publishing}>Publish {b.name}</Button>
      </div>
    </div>
  );
}
