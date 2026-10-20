'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { Badge, Card } from '@/components/ui/misc';
import { toast } from '@/components/ui/toast';
import { useWork } from '@/components/work/context';
import { api, errorMessage, toQuery } from '@/lib/api';
import { cx, money } from '@/lib/format';
import type { AdjustmentKind, PayoutBalance, WalletEntry, WalletStatement } from '@/types/payout';
import { ConfirmModal, ErrorBlock, Loading, SectionTitle, dateTimeLabel, digitsOnly } from './shared';
import { useApi } from './use-api';

const KINDS: { key: AdjustmentKind; label: string; hint: string; adds: boolean }[] = [
  { key: 'tip', label: 'Tip', hint: 'A tip a customer left for them (e.g. in cash).', adds: true },
  { key: 'bonus', label: 'Bonus', hint: 'Extra pay from you.', adds: true },
  { key: 'deduction', label: 'Deduction', hint: 'Takes money off their balance, e.g. breakages.', adds: false },
  { key: 'advance', label: 'Advance', hint: "Money you've already given them, taken off their balance.", adds: false },
];

const PAGE = 30;

type Statement = { entries: WalletEntry[]; nextOffset: number | null; total: number };

// One staff member's wallet here: balance, owner adjustments, and the statement.
export function WalletPanel({ staffId, name }: { staffId: string; name: string }) {
  const { businessId } = useWork();
  const balance = useApi<PayoutBalance>(`/businesses/${businessId}/staff/${staffId}/payout-balance`);
  const [statement, setStatement] = useState<Statement | null>(null);
  const [statementError, setStatementError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [version, setVersion] = useState(0);
  const [adjusting, setAdjusting] = useState(false);
  const [voiding, setVoiding] = useState<WalletEntry | null>(null);

  const base = `/businesses/${businessId}/staff/${staffId}/wallet/transactions`;
  useEffect(() => {
    let live = true;
    api<WalletStatement>(`${base}${toQuery({ limit: PAGE })}`).then(
      (s) => {
        if (!live) return;
        setStatement({ entries: s.entries, nextOffset: s.nextOffset, total: s.total });
        setStatementError(null);
      },
      (err) => live && setStatementError(errorMessage(err, "Couldn't load their statement.")),
    );
    return () => {
      live = false;
    };
  }, [base, version]);

  const loadMore = async () => {
    if (!statement?.nextOffset) return;
    setLoadingMore(true);
    try {
      const s = await api<WalletStatement>(`${base}${toQuery({ limit: PAGE, offset: statement.nextOffset })}`);
      setStatement((prev) => ({ entries: [...(prev?.entries ?? []), ...s.entries], nextOffset: s.nextOffset, total: s.total }));
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't load more."));
    } finally {
      setLoadingMore(false);
    }
  };

  const { reload: reloadBalance } = balance;
  const refresh = useCallback(() => {
    reloadBalance();
    setVersion((v) => v + 1);
  }, [reloadBalance]);

  const b = balance.data;
  return (
    <Card>
      <SectionTitle
        title="Wallet"
        subtitle="Commission on paid bookings, plus your adjustments, minus payouts."
        action={
          <Button size="sm" variant="secondary" onClick={() => setAdjusting(true)}>
            Add adjustment
          </Button>
        }
      />
      {balance.error && !b ? (
        <ErrorBlock message={balance.error} onRetry={balance.reload} />
      ) : !b ? (
        <Loading className="py-8" />
      ) : (
        <div className="grid gap-4 md:grid-cols-[minmax(0,240px)_1fr]">
          <div className={cx('rounded-card p-5', b.available < 0 ? 'bg-danger/5' : 'bg-surface-2')}>
            <p className="text-[13px] font-semibold text-ink-2">Available</p>
            <p className={cx('mt-1 text-3xl font-extrabold tracking-tight tabular-nums', b.available < 0 && 'text-danger')}>{money(b.available)}</p>
            {b.available < 0 ? <p className="mt-1 text-xs text-ink-2">Below zero after a deduction or advance: payouts wait until it&apos;s back up.</p> : null}
          </div>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
            {(
              [
                ['Earned', b.earned],
                ['Tips', b.tips],
                ['Bonuses', b.bonuses],
                ['Deductions', -b.deductions],
                ['Advances', -b.advances],
                ['Pending payout', -b.pending],
                ['Paid out', -b.paid],
              ] as const
            ).map(([label, value]) => (
              <div key={label}>
                <dt className="text-ink-2">{label}</dt>
                <dd className="font-semibold tabular-nums">{value < 0 ? `− ${money(-value)}` : money(value)}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      <h3 className="mt-6 mb-2 font-bold">Statement</h3>
      {statementError && !statement ? (
        <ErrorBlock message={statementError} onRetry={() => setVersion((v) => v + 1)} />
      ) : !statement ? (
        <Loading className="py-8" />
      ) : statement.entries.length === 0 ? (
        <p className="py-6 text-center text-sm text-ink-2">Nothing yet. Commission appears here once their bookings are paid.</p>
      ) : (
        <>
          <ul className="flex flex-col divide-y divide-line">
            {statement.entries.map((e) => (
              <li key={e.entryId} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">
                    {e.description}
                    {e.payoutStatus === 'pending' ? <span className="ml-2"><Badge tone="warning">Pending</Badge></span> : null}
                    {e.payoutStatus === 'rejected' ? <span className="ml-2"><Badge tone="danger">Declined</Badge></span> : null}
                  </p>
                  <p className="text-xs text-ink-2">
                    {dateTimeLabel(e.at)}
                    {e.payoutStatus === 'rejected' && e.payoutAmount ? ` · asked for ${money(e.payoutAmount)}` : ''}
                  </p>
                </div>
                <div className="text-right">
                  <p className={cx('font-semibold tabular-nums', e.amount > 0 ? 'text-success' : e.amount < 0 ? 'text-ink' : 'text-ink-3')}>
                    {e.amount > 0 ? '+' : e.amount < 0 ? '−' : ''} {money(Math.abs(e.amount))}
                  </p>
                  <p className="text-xs text-ink-3 tabular-nums">Balance {money(e.balanceAfter)}</p>
                </div>
                {e.adjustmentId ? (
                  <Button size="sm" variant="ghost" className="text-danger" onClick={() => setVoiding(e)} aria-label={`Void ${e.description}`}>
                    Void
                  </Button>
                ) : (
                  <span className="hidden w-[68px] sm:block" aria-hidden />
                )}
              </li>
            ))}
          </ul>
          {statement.nextOffset !== null ? (
            <div className="mt-3 flex justify-center">
              <Button variant="secondary" size="sm" onClick={loadMore} loading={loadingMore}>
                Load more
              </Button>
            </div>
          ) : null}
        </>
      )}

      <AdjustModal
        open={adjusting}
        staffId={staffId}
        name={name}
        onClose={() => setAdjusting(false)}
        onDone={() => {
          setAdjusting(false);
          refresh();
        }}
      />
      <ConfirmModal
        open={!!voiding}
        onClose={() => setVoiding(null)}
        title="Void this adjustment?"
        body={voiding ? `"${voiding.description}" (${money(Math.abs(voiding.amount))}) will stay on record but no longer count towards ${name}'s wallet.` : null}
        confirmLabel="Void"
        danger
        onConfirm={async () => {
          if (!voiding?.adjustmentId) return;
          try {
            await api(`/wallet-adjustments/${voiding.adjustmentId}/void`, { method: 'POST' });
            toast.success('Adjustment voided');
            setVoiding(null);
            refresh();
          } catch (err) {
            toast.error(errorMessage(err, "Couldn't void it."));
          }
        }}
      />
    </Card>
  );
}

function AdjustModal({ open, staffId, name, onClose, onDone }: { open: boolean; staffId: string; name: string; onClose: () => void; onDone: () => void }) {
  const { businessId } = useWork();
  const [kind, setKind] = useState<AdjustmentKind>('tip');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const info = KINDS.find((k) => k.key === kind)!;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = Number(amount);
    if (!(value > 0)) {
      setError('Enter an amount above 0.');
      return;
    }
    setSaving(true);
    try {
      await api(`/businesses/${businessId}/staff/${staffId}/wallet-adjustments`, {
        method: 'POST',
        body: { kind, amount: value, note: note.trim() || null, bookingId: null },
      });
      toast.success(`${info.label} of ${money(value)} ${info.adds ? 'added to' : 'taken from'} ${name}'s wallet`);
      setAmount('');
      setNote('');
      setError(null);
      onDone();
    } catch (err) {
      setError(errorMessage(err, "Couldn't adjust the wallet."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Adjust wallet"
      locked={saving}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="adjust-form" loading={saving}>
            {info.adds ? 'Add' : 'Take off'}
          </Button>
        </div>
      }
    >
      <form id="adjust-form" onSubmit={submit} className="flex flex-col gap-4 pb-2" noValidate>
        <div role="radiogroup" aria-label="Kind" className="grid grid-cols-2 gap-2">
          {KINDS.map((k) => (
            <button
              key={k.key}
              type="button"
              role="radio"
              aria-checked={kind === k.key}
              onClick={() => setKind(k.key)}
              className={cx(
                'rounded-xl border px-3 py-2.5 text-left text-sm font-semibold transition-colors',
                kind === k.key ? 'border-ink bg-ink text-white' : 'border-line-2 hover:border-ink',
              )}
            >
              {k.label}
              <span className={cx('block text-xs font-normal', kind === k.key ? 'text-white/70' : 'text-ink-2')}>{k.adds ? 'Adds' : 'Takes away'}</span>
            </button>
          ))}
        </div>
        <p className="text-sm text-ink-2">{info.hint}</p>
        <Input label="Amount (KSh)" inputMode="numeric" value={amount} onChange={(e) => setAmount(digitsOnly(e.target.value, 8))} error={error ?? undefined} />
        <Textarea label="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} hint={`${name} sees this in their wallet.`} />
      </form>
    </Modal>
  );
}
