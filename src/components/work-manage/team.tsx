'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input, Select, Switch } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { Avatar, Badge, Card, EmptyState, PageHeader } from '@/components/ui/misc';
import { toast } from '@/components/ui/toast';
import { useLiveEvent } from '@/components/notifications/live';
import { useWork, workHref } from '@/components/work/context';
import { api, errorMessage, toQuery } from '@/lib/api';
import { money, relativeTime } from '@/lib/format';
import type { PayoutRequest } from '@/types/payout';
import type { TeamInvitation, TeamRole } from '@/types/team';
import type { AddTeamMemberInput } from '@/types/work-manage';
import {
  ErrorBlock, INVITE_STATUS, Loading, ROLE_LABEL, SectionTitle, Table, WorkingDaysPicker, digitsOnly, td, th, workingDaysLabel,
  type Weekday,
} from './shared';
import { PortfolioPanel } from './portfolio';
import { invalidateBusiness } from '@/components/work-daily/use-business';
import { useApi } from './use-api';

export function memberName(m: TeamInvitation): string {
  return m.name || m.email || m.phone || 'Unnamed';
}

export function roleLabel(m: TeamInvitation): string {
  return m.role === 'staff' && m.frontDeskAccess ? 'Staff + front desk' : ROLE_LABEL[m.role];
}

export function TeamRoster() {
  const { businessId, staffId: myStaffId } = useWork();
  const { data, error, loading, reload } = useApi<{ members: TeamInvitation[] }>(`/businesses/${businessId}/team/members`);
  const [inviting, setInviting] = useState(false);

  const members = data?.members ?? [];
  const active = members.filter((m) => m.status === 'accepted');
  const pending = members.filter((m) => m.status !== 'accepted');

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Team"
        subtitle="Who works here, what they earn, and what they're owed."
        actions={<Button onClick={() => setInviting(true)}>Invite someone</Button>}
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="flex min-w-0 flex-col gap-6">
          {error && !data ? (
            <ErrorBlock message={error} onRetry={reload} />
          ) : loading && !data ? (
            <Loading label="Loading your team…" />
          ) : (
            <>
              <Card>
                <SectionTitle title="Team members" subtitle={`${active.length} active`} />
                {active.length ? (
                  <MemberTable members={active} />
                ) : (
                  <EmptyState
                    title="No one on the team yet"
                    body="Invite your staff and front desk. They join from the Trimmy app with the phone or email you enter."
                    action={<Button onClick={() => setInviting(true)}>Invite someone</Button>}
                  />
                )}
              </Card>
              {pending.length ? (
                <Card>
                  <SectionTitle title="Invitations" subtitle="Waiting for them to accept in the Trimmy app" />
                  <MemberTable members={pending} />
                </Card>
              ) : null}
              {/* An owner who takes clients is on the profile too. */}
              {myStaffId ? <PortfolioPanel staffId={myStaffId} /> : null}
            </>
          )}
        </div>
        <PayoutsWaiting />
      </div>
      <InviteModal
        open={inviting}
        onClose={() => setInviting(false)}
        onInvited={() => {
          setInviting(false);
          reload();
          invalidateBusiness(businessId); // a new member can change the calendar's staff
        }}
      />
    </div>
  );
}

function MemberTable({ members }: { members: TeamInvitation[] }) {
  const { businessId } = useWork();
  return (
    <>
      {/* Phones get cards; wider screens a table. */}
      <ul className="flex flex-col divide-y divide-line md:hidden">
        {members.map((m) => (
          <li key={m.invitationId}>
            <Link href={workHref(businessId, `team/${m.invitationId}`)} className="flex items-center gap-3 py-3">
              <Avatar name={memberName(m)} src={m.avatarUrl} size={44} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{memberName(m)}</p>
                <p className="truncate text-sm text-ink-2">
                  {roleLabel(m)}{m.commissionPercent === null ? '' : ` · ${m.commissionPercent}%`} · {workingDaysLabel(m.workingDays)}
                </p>
              </div>
              <Badge tone={INVITE_STATUS[m.status].tone}>{INVITE_STATUS[m.status].label}</Badge>
            </Link>
          </li>
        ))}
      </ul>
      <div className="hidden md:block">
        <Table
          head={
            <tr>
              <th className={th}>Name</th>
              <th className={th}>Role</th>
              <th className={th}>Commission</th>
              <th className={th}>Works</th>
              <th className={th}>Status</th>
            </tr>
          }
        >
          {members.map((m) => (
            <tr key={m.invitationId} className="hover:bg-surface-2/60">
              <td className={td}>
                <Link href={workHref(businessId, `team/${m.invitationId}`)} className="flex items-center gap-3 font-semibold hover:underline">
                  <Avatar name={memberName(m)} src={m.avatarUrl} size={36} />
                  <span className="min-w-0">
                    <span className="block truncate">{memberName(m)}</span>
                    {m.name && (m.phone || m.email) ? <span className="block truncate text-xs font-normal text-ink-2">{m.phone || m.email}</span> : null}
                  </span>
                </Link>
              </td>
              <td className={td}>{roleLabel(m)}</td>
              <td className={`${td} tabular-nums`}>{m.commissionPercent === null ? '—' : `${m.commissionPercent}%`}</td>
              <td className={`${td} text-ink-2`}>{workingDaysLabel(m.workingDays)}</td>
              <td className={td}>
                <Badge tone={INVITE_STATUS[m.status].tone}>{INVITE_STATUS[m.status].label}</Badge>
                {m.status === 'pending' ? <span className="ml-2 text-xs text-ink-3">sent {relativeTime(m.sentAt)}</span> : null}
              </td>
            </tr>
          ))}
        </Table>
      </div>
    </>
  );
}

// Pending withdrawal requests, so the owner sees what's owed from the roster.
export function PayoutsWaiting() {
  const { businessId } = useWork();
  const { data, error, loading, reload } = useApi<{ payouts: PayoutRequest[] }>(`/businesses/${businessId}/payouts${toQuery({ status: 'pending' })}`);
  useLiveEvent((type) => type === 'payout_requested', reload);
  const payouts = data?.payouts ?? [];
  const total = payouts.reduce((s, p) => s + p.amount, 0);
  return (
    <Card className="h-fit">
      <SectionTitle
        title="Payouts waiting"
        subtitle={payouts.length ? `${money(total)} requested` : undefined}
        action={
          <Link href={workHref(businessId, 'payouts')} className="text-sm font-semibold text-brand hover:underline">
            All payouts
          </Link>
        }
      />
      {error && !data ? (
        <ErrorBlock message={error} onRetry={reload} />
      ) : loading && !data ? (
        <Loading className="py-8" />
      ) : payouts.length ? (
        <ul className="flex flex-col divide-y divide-line">
          {payouts.slice(0, 6).map((p) => (
            <li key={p.payoutId}>
              <Link href={workHref(businessId, `payouts/${p.payoutId}`)} className="flex items-center gap-3 py-3 hover:opacity-80">
                <Avatar name={p.staffName} src={p.staffAvatarUrl} size={36} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{p.staffName}</p>
                  <p className="text-xs text-ink-2">{relativeTime(p.requestedAt)}</p>
                </div>
                <span className="font-bold tabular-nums">{money(p.amount, p.currency)}</span>
              </Link>
            </li>
          ))}
          {payouts.length > 6 ? (
            <li className="pt-3 text-sm text-ink-2">
              and {payouts.length - 6} more…
            </li>
          ) : null}
        </ul>
      ) : (
        <p className="py-6 text-center text-sm text-ink-2">Nobody is waiting on a payout.</p>
      )}
    </Card>
  );
}

const EMPTY_FORM = { name: '', contact: 'phone' as 'phone' | 'email', phone: '', email: '', role: 'staff' as TeamRole, commission: '40', alsoDesk: false };

export function InviteModal({ open, onClose, onInvited }: { open: boolean; onClose: () => void; onInvited: (m: TeamInvitation) => void }) {
  const { businessId } = useWork();
  const [form, setForm] = useState(EMPTY_FORM);
  const [days, setDays] = useState<Weekday[] | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof typeof EMPTY_FORM>(k: K, v: (typeof EMPTY_FORM)[K]) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!form.name.trim()) next.name = 'Enter their name.';
    if (form.contact === 'phone' && !/^\+?\d{9,15}$/.test(form.phone.replace(/\s/g, ''))) next.phone = 'Enter a phone number, e.g. 0712 345 678.';
    if (form.contact === 'email' && !/^\S+@\S+\.\S+$/.test(form.email.trim())) next.email = 'Enter an email address.';
    const commission = Number(form.commission);
    if (form.role === 'staff' && (form.commission === '' || commission > 100)) next.commission = 'Between 0 and 100.';
    if (days && !days.length) next.days = 'Pick at least one day, or let them work whenever you are open.';
    setErrors(next);
    if (Object.keys(next).length) return;

    const input: AddTeamMemberInput = {
      name: form.name.trim(),
      role: form.role,
      // Front desk performs no services: no commission.
      ...(form.role === 'staff' ? { commissionPercent: commission, frontDeskAccess: form.alsoDesk } : {}),
      workingDays: days,
      ...(form.contact === 'phone' ? { phone: form.phone.replace(/\s/g, '') } : { email: form.email.trim() }),
    };
    setSaving(true);
    try {
      const created = await api<TeamInvitation>(`/businesses/${businessId}/team/members`, { method: 'POST', body: input });
      toast.success(`Invitation sent to ${input.name}`);
      setForm(EMPTY_FORM);
      setDays(null);
      onInvited(created);
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't send the invitation."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Invite to your team"
      locked={saving}
      wide
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="invite-form" loading={saving}>
            Send invitation
          </Button>
        </div>
      }
    >
      <form id="invite-form" onSubmit={submit} className="flex flex-col gap-4 pb-2" noValidate>
        <Input label="Name" value={form.name} onChange={(e) => set('name', e.target.value)} error={errors.name} autoComplete="off" maxLength={100} />
        <div className="flex flex-col gap-2">
          <div className="flex gap-2" role="radiogroup" aria-label="Invite by">
            {(['phone', 'email'] as const).map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={form.contact === c}
                onClick={() => set('contact', c)}
                className={`rounded-full px-3 py-1.5 text-sm font-semibold ${form.contact === c ? 'bg-ink text-white' : 'bg-surface-3'}`}
              >
                {c === 'phone' ? 'Phone' : 'Email'}
              </button>
            ))}
          </div>
          {form.contact === 'phone' ? (
            <Input label="Phone" type="tel" inputMode="tel" placeholder="0712 345 678" value={form.phone} onChange={(e) => set('phone', e.target.value)} error={errors.phone} hint="They join from the Trimmy app using this number." />
          ) : (
            <Input label="Email" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} error={errors.email} hint="They join from the Trimmy app using this email." />
          )}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Select label="Role" value={form.role} onChange={(e) => set('role', e.target.value as TeamRole)} hint={form.role === 'front_desk' ? 'Runs the day: bookings, check-ins and payments.' : 'Takes clients.'}>
            <option value="staff">Staff</option>
            <option value="front_desk">Front desk</option>
          </Select>
          {form.role === 'staff' ? (
            <Input label="Commission %" inputMode="numeric" value={form.commission} onChange={(e) => set('commission', digitsOnly(e.target.value, 3))} error={errors.commission} hint="Their share of each paid booking." />
          ) : (
            <p className="self-center text-sm text-ink-2">No commission: front desk doesn&apos;t perform services.</p>
          )}
        </div>
        {form.role === 'staff' ? (
          <div className="flex items-center justify-between gap-4 rounded-2xl bg-ink/[0.03] p-4">
            <div>
              <p className="font-semibold">Also runs the front desk</p>
              <p className="text-sm text-ink-2">They can switch to the desk to check customers in and out. Commission stays on their own services.</p>
            </div>
            <Switch checked={form.alsoDesk} onChange={(v) => set('alsoDesk', v)} label="Also runs the front desk" />
          </div>
        ) : null}
        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold">Working days</p>
          <WorkingDaysPicker value={days} onChange={setDays} />
          {errors.days ? <p className="text-[13px] text-danger">{errors.days}</p> : null}
        </div>
      </form>
    </Modal>
  );
}

