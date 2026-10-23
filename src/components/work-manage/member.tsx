'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button, ButtonLink } from '@/components/ui/button';
import { Input, Switch } from '@/components/ui/field';
import { Avatar, Badge, Card, EmptyState } from '@/components/ui/misc';
import { toast } from '@/components/ui/toast';
import { useWork, workHref } from '@/components/work/context';
import { api, errorMessage } from '@/lib/api';
import { cx, money } from '@/lib/format';
import type { TeamInvitation } from '@/types/team';
import type { ServiceCategoryWithServices, StaffServices } from '@/types/work-manage';
import {
  BackLink, ConfirmModal, ErrorBlock, INVITE_STATUS, Loading, SectionTitle, WorkingDaysPicker, dateTimeLabel, digitsOnly,
  type Weekday,
} from './shared';
import { memberName, roleLabel } from './team';
import { PortfolioPanel } from './portfolio';
import { invalidateBusiness } from '@/components/work-daily/use-business';
import { TimeOffPanel } from './time-off';
import { useApi } from './use-api';
import { WalletPanel } from './wallet';

// Team members are addressed by invitationId (the roster record, pending or
// accepted). Services, wallet and time off hang off staffId, which only
// exists once they've accepted.
export function MemberDetail({ memberId }: { memberId: string }) {
  const { businessId } = useWork();
  const router = useRouter();
  const { data, error, loading, reload, mutate } = useApi<{ members: TeamInvitation[] }>(`/businesses/${businessId}/team/members`);
  const [removing, setRemoving] = useState(false);
  const member = data?.members.find((m) => m.invitationId === memberId);

  if (error && !data) return <ErrorBlock message={error} onRetry={reload} />;
  if (loading && !data) return <Loading label="Loading…" />;
  if (!member) {
    return (
      <>
        <BackLink href={workHref(businessId, 'team')}>Team</BackLink>
        <EmptyState title="Not on your team" body="They may have been removed, or the invitation cancelled." />
      </>
    );
  }

  const name = memberName(member);
  const pending = member.status !== 'accepted';
  const replace = (m: TeamInvitation) => mutate((d) => ({ members: d.members.map((x) => (x.invitationId === m.invitationId ? m : x)) }));

  return (
    <div className="flex flex-col gap-6">
      <BackLink href={workHref(businessId, 'team')}>Team</BackLink>
      <div className="flex flex-wrap items-center gap-4">
        <Avatar name={name} size={64} />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-extrabold tracking-tight sm:text-3xl">{name}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-ink-2">
            <Badge tone={INVITE_STATUS[member.status].tone}>{INVITE_STATUS[member.status].label}</Badge>
            <span>{roleLabel(member)}</span>
            {member.phone ? <span>· {member.phone}</span> : null}
            {member.email ? <span>· {member.email}</span> : null}
          </p>
          {pending ? <p className="mt-1 text-sm text-ink-3">Invited {dateTimeLabel(member.sentAt)}</p> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {member.staffId ? (
            <ButtonLink href={`${workHref(businessId, 'earnings')}?staffId=${member.staffId}`} variant="secondary" size="sm">
              View earnings
            </ButtonLink>
          ) : null}
          <Button variant="danger" size="sm" onClick={() => setRemoving(true)}>
            {member.status === 'pending' ? 'Cancel invitation' : 'Remove from team'}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <SettingsCard member={member} onSaved={replace} />
        {member.staffId ? (
          <ServicesCard staffId={member.staffId} role={member.role} />
        ) : (
          <Card>
            <SectionTitle title="Services, wallet and time off" />
            <p className="text-ink-2">
              {member.status === 'declined'
                ? 'They declined the invitation. Remove it and invite them again if that was a mistake.'
                : 'These open up once they accept the invitation in the Trimmy app.'}
            </p>
          </Card>
        )}
      </div>
      {member.staffId ? (
        <div className="grid gap-6 xl:grid-cols-[3fr_2fr]">
          <WalletPanel staffId={member.staffId} name={name} />
          <TimeOffPanel staffId={member.staffId} name={name} />
        </div>
      ) : null}
      {member.staffId && member.role !== 'front_desk' ? <PortfolioPanel staffId={member.staffId} name={name} /> : null}

      <ConfirmModal
        open={removing}
        onClose={() => setRemoving(false)}
        title={member.status === 'pending' ? 'Cancel this invitation?' : `Remove ${name}?`}
        body={
          member.status === 'pending'
            ? "They won't be able to join with it any more."
            : `${name} loses access to the business and can no longer be booked. Their wallet history is kept; settle anything they're owed first.`
        }
        confirmLabel={member.status === 'pending' ? 'Cancel invitation' : 'Remove'}
        danger
        onConfirm={async () => {
          try {
            await api(`/businesses/${businessId}/team/members/${member.invitationId}`, { method: 'DELETE' });
            invalidateBusiness(businessId);
            toast.success(member.status === 'pending' ? 'Invitation cancelled' : `${name} removed from the team`);
            router.push(workHref(businessId, 'team'));
          } catch (err) {
            toast.error(errorMessage(err, "Couldn't remove them."));
          }
        }}
      />
    </div>
  );
}

function SettingsCard({ member, onSaved }: { member: TeamInvitation; onSaved: (m: TeamInvitation) => void }) {
  const { businessId } = useWork();
  const wasTaking = member.role !== 'front_desk';
  const hadDesk = member.role === 'front_desk' || !!member.frontDeskAccess;
  const [takes, setTakes] = useState(wasTaking);
  const [desk, setDesk] = useState(hadDesk);
  const [commission, setCommission] = useState(String(member.commissionPercent ?? 40));
  const [days, setDays] = useState<Weekday[] | null>(member.workingDays);
  const [saving, setSaving] = useState(false);
  const value = Number(commission);
  // Front desk only: no commission to check. At least one of the two must stay on.
  const commissionError = takes && (commission === '' || value > 100) ? 'Between 0 and 100.' : undefined;
  const modesError = !takes && !desk ? 'Turn at least one on.' : undefined;
  const daysError = days && days.length === 0 ? 'Pick at least one day.' : undefined;
  const modesChanged = takes !== wasTaking || desk !== hadDesk;
  const changed =
    modesChanged || (takes && value !== member.commissionPercent) || JSON.stringify(days) !== JSON.stringify(member.workingDays);

  const save = async () => {
    setSaving(true);
    try {
      const updated = await api<TeamInvitation>(`/businesses/${businessId}/team/members/${member.invitationId}`, {
        method: 'PATCH',
        body: {
          workingDays: days,
          ...(modesChanged ? { takesAppointments: takes, frontDeskAccess: desk } : {}),
          ...(takes ? { commissionPercent: value } : {}),
        },
      });
      onSaved(updated);
      invalidateBusiness(businessId); // name, days or role changes show on the calendar
      toast.success('Saved');
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't save."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <SectionTitle title="Role, pay and schedule" />
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-2 rounded-2xl bg-ink/[0.03] p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-semibold">Takes appointments</p>
              <p className="text-sm text-ink-2">Bookable for services; earns commission on their own work.</p>
            </div>
            <Switch checked={takes} onChange={setTakes} label="Takes appointments" />
          </div>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-semibold">Runs the front desk</p>
              <p className="text-sm text-ink-2">Checks customers in and out and takes payments. With both on, they switch between the two.</p>
            </div>
            <Switch checked={desk} onChange={setDesk} label="Runs the front desk" />
          </div>
          {modesError ? (
            <p className="text-[13px] text-danger">{modesError}</p>
          ) : !takes && wasTaking ? (
            <p className="text-[13px] text-ink-2">Front desk only: their commission is removed. Reassign any upcoming appointments first.</p>
          ) : null}
        </div>
        {takes ? (
          <Input
            label="Commission %"
            inputMode="numeric"
            value={commission}
            onChange={(e) => setCommission(digitsOnly(e.target.value, 3))}
            error={commissionError}
            hint="Their share of each paid booking, fixed when the booking is paid."
            className="max-w-56"
          />
        ) : null}
        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold">Working days</p>
          <WorkingDaysPicker value={days} onChange={setDays} />
          {daysError ? <p className="text-[13px] text-danger">{daysError}</p> : null}
        </div>
        <div className="flex gap-2">
          <Button onClick={save} loading={saving} disabled={!changed || !!commissionError || !!modesError || !!daysError}>
            Save changes
          </Button>
          {changed ? (
            <Button
              variant="ghost"
              onClick={() => {
                setTakes(wasTaking);
                setDesk(hadDesk);
                setCommission(String(member.commissionPercent ?? 40));
                setDays(member.workingDays);
              }}
            >
              Undo
            </Button>
          ) : null}
        </div>
      </div>
    </Card>
  );
}

function ServicesCard({ staffId, role }: { staffId: string; role: TeamInvitation['role'] }) {
  const { businessId } = useWork();
  const saved = useApi<StaffServices>(`/businesses/${businessId}/staff/${staffId}/services`);
  const menu = useApi<{ categories: ServiceCategoryWithServices[] }>(`/businesses/${businessId}/service-categories`);
  const [draft, setDraft] = useState<StaffServices | null>(null);
  const [saving, setSaving] = useState(false);

  const current = draft ?? saved.data;
  const allIds = (menu.data?.categories ?? []).flatMap((c) => c.services.map((s) => s.serviceId));
  const changed = !!draft && !!saved.data && JSON.stringify(normalise(draft)) !== JSON.stringify(normalise(saved.data));

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      const body = { allServices: draft.allServices, serviceIds: draft.allServices ? [] : draft.serviceIds };
      const result = await api<StaffServices>(`/businesses/${businessId}/staff/${staffId}/services`, { method: 'PUT', body });
      saved.mutate(() => result);
      setDraft(null);
      invalidateBusiness(businessId); // who can take which bookings
      toast.success('Services saved');
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't save their services."));
    } finally {
      setSaving(false);
    }
  };

  const toggle = (id: string) => {
    if (!current) return;
    const ids = current.allServices ? allIds : current.serviceIds;
    setDraft({ allServices: false, serviceIds: ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id] });
  };

  return (
    <Card>
      <SectionTitle
        title="Services they perform"
        subtitle={role === 'front_desk' ? 'Front desk usually take no clients; pick any they do.' : 'Customers can only book them for these.'}
      />
      {(saved.error && !saved.data) || (menu.error && !menu.data) ? (
        <ErrorBlock
          message={saved.error ?? menu.error ?? ''}
          onRetry={() => {
            saved.reload();
            menu.reload();
          }}
        />
      ) : !current || !menu.data ? (
        <Loading className="py-8" />
      ) : (
        <div className="flex flex-col gap-4">
          <label className="flex items-start gap-3 rounded-xl border border-line p-3">
            <input
              type="checkbox"
              className="mt-0.5 size-4 accent-ink"
              checked={current.allServices}
              onChange={(e) => setDraft({ allServices: e.target.checked, serviceIds: e.target.checked ? [] : allIds })}
            />
            <span>
              <span className="font-semibold">All services</span>
              <span className="block text-sm text-ink-2">Including any you add later.</span>
            </span>
          </label>
          {menu.data.categories.length === 0 ? (
            <p className="text-sm text-ink-2">Your menu has no services yet.</p>
          ) : (
            <div className="flex max-h-80 flex-col gap-4 overflow-y-auto pr-1">
              {menu.data.categories.map((c) => (
                <fieldset key={c.categoryId}>
                  <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-3">{c.name}</legend>
                  {c.services.map((s) => {
                    const on = current.allServices || current.serviceIds.includes(s.serviceId);
                    return (
                      <label key={s.serviceId} className={cx('flex items-center gap-3 py-1.5', current.allServices && 'text-ink-2')}>
                        <input type="checkbox" className="size-4 accent-ink" checked={on} onChange={() => toggle(s.serviceId)} />
                        <span className="flex-1">{s.name}</span>
                        <span className="text-sm text-ink-2 tabular-nums">{money(s.price)}</span>
                      </label>
                    );
                  })}
                </fieldset>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <Button onClick={save} loading={saving} disabled={!changed}>
              Save services
            </Button>
            {changed ? (
              <Button variant="ghost" onClick={() => setDraft(null)}>
                Undo
              </Button>
            ) : null}
          </div>
        </div>
      )}
    </Card>
  );
}

function normalise(s: StaffServices) {
  return { allServices: s.allServices, serviceIds: s.allServices ? [] : [...s.serviceIds].sort() };
}
