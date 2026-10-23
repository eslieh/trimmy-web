'use client';

import { useState } from 'react';
import { useSession } from '@/components/session';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { toast } from '@/components/ui/toast';
import { api, errorMessage } from '@/lib/api';
import { cx } from '@/lib/format';

type Target = 'business' | 'review' | 'customer' | 'booking';

const REASONS: Record<Target, { key: string; label: string }[]> = {
  business: [
    { key: 'fraud', label: 'Scam or fake business' },
    { key: 'safety', label: "I didn't feel safe" },
    { key: 'harassment', label: 'Rude or harassing' },
    { key: 'inappropriate', label: 'Offensive photos or words' },
    { key: 'other', label: 'Something else' },
  ],
  review: [
    { key: 'fake_review', label: 'Fake: they never came' },
    { key: 'harassment', label: 'Abusive or personal' },
    { key: 'inappropriate', label: 'Offensive words' },
    { key: 'other', label: 'Something else' },
  ],
  customer: [
    { key: 'no_show', label: 'Keeps not showing up' },
    { key: 'harassment', label: 'Rude or harassing' },
    { key: 'fraud', label: 'Fraud (e.g. fake payment)' },
    { key: 'safety', label: 'Safety concern' },
    { key: 'other', label: 'Something else' },
  ],
  booking: [
    { key: 'fraud', label: 'Fraud or a payment problem' },
    { key: 'safety', label: 'Safety concern' },
    { key: 'other', label: 'Something else' },
  ],
};

// A quiet "Report" link: tell Trimmy's team about a business, a review or a customer.
// Signed-in people only (nothing shows otherwise). Nothing happens to the other person automatically.
export function ReportButton({ targetType, targetId, name, label = 'Report', className }: {
  targetType: Target; targetId: string; name: string; label?: string; className?: string;
}) {
  const { session } = useSession();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (!session) return null;

  const send = async () => {
    setBusy(true);
    setError('');
    try {
      await api('/reports', { method: 'POST', body: { targetType, targetId, reason, details: details.trim() || null } });
      toast("Thanks for telling us. Trimmy's team will look at it.");
      setOpen(false);
      setReason('');
      setDetails('');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={cx('text-sm text-ink-3 underline hover:text-ink', className)}>{label}</button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={`Report ${name}`}
        locked={busy}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
            <Button onClick={send} loading={busy} disabled={!reason}>Send report</Button>
          </div>
        }
      >
        <p className="text-ink-2">Only Trimmy&apos;s team sees this. They aren&apos;t told who reported them.</p>
        <fieldset className="mt-4 flex flex-col gap-2">
          <legend className="sr-only">Why are you reporting?</legend>
          {REASONS[targetType].map((r) => (
            <label key={r.key} className={cx('flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3', reason === r.key ? 'border-ink bg-accent-soft' : 'border-line-2')}>
              <input type="radio" name="reason" value={r.key} checked={reason === r.key} onChange={() => setReason(r.key)} className="accent-ink" />
              {r.label}
            </label>
          ))}
        </fieldset>
        <Textarea label="What happened? (optional)" value={details} onChange={(e) => setDetails(e.target.value)} rows={3} maxLength={2000} className="mt-4" />
        {error ? <p role="alert" className="mt-2 text-sm font-semibold text-danger">{error}</p> : null}
      </Modal>
    </>
  );
}
