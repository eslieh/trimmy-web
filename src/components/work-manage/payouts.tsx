'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { Avatar, Badge, Card, EmptyState, PageHeader, Tabs } from '@/components/ui/misc';
import { toast } from '@/components/ui/toast';
import { useLiveEvent } from '@/components/notifications/live';
import { useWork, workHref } from '@/components/work/context';
import { api, errorMessage, toQuery } from '@/lib/api';
import { cx, money, relativeTime } from '@/lib/format';
import type { PayoutBalance, PayoutRequest, PayoutStatus } from '@/types/payout';
import type { TeamInvitation } from '@/types/team';
import { BackLink, ErrorBlock, Loading, SectionTitle, Table, dateTimeLabel, td, th } from './shared';
import { useApi } from './use-api';

const STATUS: Record<PayoutStatus, { label: string; tone: 'warning' | 'success' | 'danger' }> = {
  pending: { label: 'Waiting', tone: 'warning' },
  paid: { label: 'Paid', tone: 'success' },
  rejected: { label: 'Declined', tone: 'danger' },
};

type HistoryFilter = 'all' | 'paid' | 'rejected';

export function PayoutsPage() {
  const { businessId } = useWork();
  const pending = useApi<{ payouts: PayoutRequest[] }>(`/businesses/${businessId}/payouts${toQuery({ status: 'pending' })}`);
  const [filter, setFilter] = useState<HistoryFilter>('all');
  const history = useApi<{ payouts: PayoutRequest[] }>(
    `/businesses/${businessId}/payouts${toQuery({ status: filter === 'all' ? undefined : filter })}`,
  );
  const [responding, setResponding] = useState<{ payout: PayoutRequest; action: 'approve' | 'reject' } | null>(null);

  const { reload: reloadPending } = pending;
  const { reload: reloadHistory } = history;
  useLiveEvent(
    (type) => type === 'payout_requested',
    () => reloadPending(),
  );
  const refresh = () => {
    reloadPending();
    reloadHistory();
  };

  const queue = pending.data?.payouts ?? [];
  const past = (history.data?.payouts ?? []).filter((p) => p.status !== 'pending');
  const owed = queue.reduce((s, p) => s + p.amount, 0);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Payouts"
        subtitle="Your team asks to withdraw from their wallet; you pay them by M-Pesa or cash, then mark it paid here."
      />
      <Card>
        <SectionTitle title="Waiting for you" subtitle={queue.length ? `${queue.length} ${queue.length === 1 ? 'request' : 'requests'} · ${money(owed)}` : undefined} />
        {pending.error && !pending.data ? (
          <ErrorBlock message={pending.error} onRetry={pending.reload} />
        ) : pending.loading && !pending.data ? (
          <Loading className="py-8" />
        ) : queue.length === 0 ? (
          <p className="py-6 text-center text-ink-2">You&apos;re all caught up. New requests appear here.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line">
            {queue.map((p) => (
              <li key={p.payoutId} className="flex flex-wrap items-center gap-3 py-3.5">
                <Link href={workHref(businessId, `payouts/${p.payoutId}`)} className="flex min-w-0 flex-1 items-center gap-3 hover:opacity-80">
                  <Avatar name={p.staffName} src={p.staffAvatarUrl} size={40} />
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{p.staffName}</p>
                    <p className="text-sm text-ink-2">Asked {relativeTime(p.requestedAt)}</p>
                  </div>
                </Link>
                <span className="text-lg font-extrabold tabular-nums">{money(p.amount, p.currency)}</span>
                <div className="flex w-full gap-2 sm:w-auto">
                  <Button size="sm" variant="secondary" className="flex-1 sm:flex-none" onClick={() => setResponding({ payout: p, action: 'reject' })}>
                    Decline
                  </Button>
                  <Button size="sm" className="flex-1 sm:flex-none" onClick={() => setResponding({ payout: p, action: 'approve' })}>
                    I&apos;ve paid it
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <SectionTitle
          title="History"
          action={
            <Tabs
              value={filter}
              onChange={setFilter}
              options={[
                { key: 'all', label: 'All' },
                { key: 'paid', label: 'Paid' },
                { key: 'rejected', label: 'Declined' },
              ]}
            />
          }
        />
        {history.error && !history.data ? (
          <ErrorBlock message={history.error} onRetry={history.reload} />
        ) : history.loading && !history.data ? (
          <Loading className="py-8" />
        ) : past.length === 0 ? (
          <EmptyState title="No payouts yet" body="Payouts you've paid or declined are kept here." />
        ) : (
          <div className={cx(history.loading && 'opacity-60')}>
            <Table
              head={
                <tr>
                  <th className={th}>Team member</th>
                  <th className={th}>Requested</th>
                  <th className={th}>Answered</th>
                  <th className={th}>Status</th>
                  <th className={cx(th, 'text-right')}>Amount</th>
                </tr>
              }
            >
              {past.map((p) => (
                <tr key={p.payoutId} className="hover:bg-surface-2/60">
                  <td className={td}>
                    <Link href={workHref(businessId, `payouts/${p.payoutId}`)} className="font-semibold hover:underline">
                      {p.staffName}
                    </Link>
                  </td>
                  <td className={cx(td, 'whitespace-nowrap text-ink-2')}>{dateTimeLabel(p.requestedAt)}</td>
                  <td className={cx(td, 'whitespace-nowrap text-ink-2')}>{p.respondedAt ? dateTimeLabel(p.respondedAt) : '–'}</td>
                  <td className={td}>
                    <Badge tone={STATUS[p.status].tone}>{STATUS[p.status].label}</Badge>
                  </td>
                  <td className={cx(td, 'text-right font-semibold tabular-nums')}>{money(p.amount, p.currency)}</td>
                </tr>
              ))}
            </Table>
          </div>
        )}
      </Card>

      <RespondModal
        state={responding}
        onClose={() => setResponding(null)}
        onDone={() => {
          setResponding(null);
          refresh();
        }}
      />
    </div>
  );
}

export function PayoutDetail({ payoutId }: { payoutId: string }) {
  const { businessId } = useWork();
  const { data: payout, error, loading, reload, mutate } = useApi<PayoutRequest>(`/payouts/${payoutId}`);
  const [action, setAction] = useState<'approve' | 'reject' | null>(null);
  const staffId = payout?.staffId ?? null;
  const balance = useApi<PayoutBalance>(staffId && payout?.status === 'pending' ? `/businesses/${businessId}/staff/${staffId}/payout-balance` : null);
  const team = useApi<{ members: TeamInvitation[] }>(staffId ? `/businesses/${businessId}/team/members` : null);
  const member = team.data?.members.find((m) => m.staffId === staffId);

  useLiveEvent(
    (type) => type === 'payout_requested',
    () => reload(),
  );

  const back = <BackLink href={workHref(businessId, 'payouts')}>Payouts</BackLink>;
  if (error && !payout) return (<>{back}<ErrorBlock message={error} onRetry={reload} /></>);
  if (loading && !payout) return (<>{back}<Loading /></>);
  if (!payout) return null;
  if (payout.businessId !== businessId) {
    return (<>{back}<EmptyState title="Not this business's payout" /></>);
  }

  const s = STATUS[payout.status];
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <div>{back}</div>
      <Card className="p-6! sm:p-8!">
        <div className="flex items-start gap-4">
          <Avatar name={payout.staffName} src={payout.staffAvatarUrl} size={56} />
          <div className="min-w-0 flex-1">
            <p className="text-sm text-ink-2">Payout request</p>
            <h1 className="truncate text-xl font-extrabold">{payout.staffName}</h1>
            {member ? (
              <Link href={workHref(businessId, `team/${member.invitationId}`)} className="text-sm font-semibold text-brand hover:underline">
                View their wallet
              </Link>
            ) : null}
          </div>
          <Badge tone={s.tone}>{s.label}</Badge>
        </div>
        <p className="mt-6 text-4xl font-extrabold tracking-tight tabular-nums">{money(payout.amount, payout.currency)}</p>
        <dl className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-ink-2">Requested</dt>
            <dd className="font-semibold">{dateTimeLabel(payout.requestedAt)}</dd>
          </div>
          {payout.respondedAt ? (
            <div>
              <dt className="text-ink-2">{payout.status === 'paid' ? 'Marked paid' : 'Declined'}</dt>
              <dd className="font-semibold">{dateTimeLabel(payout.respondedAt)}</dd>
            </div>
          ) : null}
          {balance.data ? (
            <div>
              <dt className="text-ink-2">Their wallet</dt>
              <dd className="font-semibold">
                {money(balance.data.available)} available · {money(balance.data.pending)} pending
              </dd>
            </div>
          ) : null}
          {payout.rejectionReason ? (
            <div className="sm:col-span-2">
              <dt className="text-ink-2">Reason</dt>
              <dd className="font-semibold">{payout.rejectionReason}</dd>
            </div>
          ) : null}
        </dl>
        {payout.status === 'pending' ? (
          <>
            <p className="mt-6 rounded-xl bg-surface-2 p-4 text-sm text-ink-2">
              Trimmy doesn&apos;t move this money. Send it to {payout.staffName} yourself by M-Pesa or cash, then mark it paid. Declining puts the amount back in their wallet.
            </p>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="secondary" onClick={() => setAction('reject')}>
                Decline
              </Button>
              <Button onClick={() => setAction('approve')}>I&apos;ve paid it</Button>
            </div>
          </>
        ) : null}
      </Card>
      <RespondModal
        state={action ? { payout, action } : null}
        onClose={() => setAction(null)}
        onDone={(updated) => {
          setAction(null);
          mutate(() => updated);
          balance.reload();
        }}
      />
    </div>
  );
}

function RespondModal({
  state, onClose, onDone,
}: {
  state: { payout: PayoutRequest; action: 'approve' | 'reject' } | null;
  onClose: () => void;
  onDone: (p: PayoutRequest) => void;
}) {
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const approve = state?.action === 'approve';

  const submit = async () => {
    if (!state) return;
    setSaving(true);
    try {
      const updated = await api<PayoutRequest>(`/payouts/${state.payout.payoutId}/respond`, {
        method: 'POST',
        body: { action: state.action, rejectionReason: approve ? null : reason.trim() || null },
      });
      toast.success(approve ? `Marked ${money(state.payout.amount)} to ${state.payout.staffName} as paid` : 'Payout declined');
      setReason('');
      onDone(updated);
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't update the payout."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={!!state}
      onClose={onClose}
      title={approve ? 'Mark as paid' : 'Decline payout'}
      locked={saving}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant={approve ? 'primary' : 'danger'} onClick={submit} loading={saving}>
            {approve ? "Yes, I've sent it" : 'Decline'}
          </Button>
        </div>
      }
    >
      {state ? (
        approve ? (
          <div className="flex flex-col gap-3 pb-2 text-ink-2">
            <p>
              Have you sent <strong className="text-ink">{money(state.payout.amount, state.payout.currency)}</strong> to{' '}
              <strong className="text-ink">{state.payout.staffName}</strong> by M-Pesa or cash?
            </p>
            <p className="text-sm">Trimmy only records it: the money doesn&apos;t move through the app. They&apos;ll be told it&apos;s paid.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3 pb-2">
            <p className="text-ink-2">
              {money(state.payout.amount, state.payout.currency)} goes back into {state.payout.staffName}&apos;s wallet.
            </p>
            <Textarea label="Reason (optional)" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} hint="They see this." />
          </div>
        )
      ) : null}
    </Modal>
  );
}
