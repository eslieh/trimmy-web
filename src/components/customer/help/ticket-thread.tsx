'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';
import { api, errorMessage } from '@/lib/api';
import { cx } from '@/lib/format';
import { STATUS_LABEL, type Ticket } from '@/types/support';

function stamp(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}

// One question and Trimmy's answers; refreshes every 30 seconds while open.
export function TicketThread({ ticketId }: { ticketId: string }) {
  const [data, setData] = useState<Ticket | null>(null);
  const [error, setError] = useState('');
  const [text, setText] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => api<Ticket>(`/support/tickets/${ticketId}`).then(setData, (err) => setError(errorMessage(err))), [ticketId]);
  useEffect(() => {
    load();
    const id = setInterval(() => document.visibilityState === 'visible' && load(), 30_000);
    return () => clearInterval(id);
  }, [load]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() && !photo) return;
    setBusy(true);
    const form = new FormData();
    form.set('body', text.trim());
    if (photo) form.set('photo', photo);
    try {
      setData(await api<Ticket>(`/support/tickets/${ticketId}/messages`, { method: 'POST', body: form }));
      setText('');
      setPhoto(null);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (!data) return <p className="py-16 text-center text-ink-2">{error || 'Loading…'}</p>;
  const t = data.ticket;
  const sorted = t.status === 'resolved' || t.status === 'closed';

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <Link href="/account/help" className="text-sm font-semibold text-ink-2 hover:text-ink">← Help</Link>
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t.subject}</h1>
        <p className="mt-1 text-sm text-ink-2">
          #{t.number} · {STATUS_LABEL[t.status]}
          {data.bookingReference ? ` · booking ${data.bookingReference}` : data.businessName ? ` · ${data.businessName}` : ''}
        </p>
      </div>

      <section className="flex flex-col gap-3 rounded-card border border-line p-5">
        {data.messages.map((m) => {
          const mine = m.kind === 'customer';
          return (
            <div key={m.id} className={cx('flex', mine ? 'justify-end' : 'justify-start')}>
              <div className={cx('max-w-[85%] rounded-2xl px-4 py-3', mine ? 'bg-ink text-white' : 'bg-accent-soft')}>
                {!mine ? <p className="mb-1 text-xs font-semibold text-accent-foreground">{m.authorName}</p> : null}
                {m.body ? <p className="whitespace-pre-wrap break-words">{m.body}</p> : null}
                {m.attachmentUrl ? (
                  <a href={m.attachmentUrl} target="_blank" rel="noreferrer" className="mt-2 block">
                    {/* eslint-disable-next-line @next/next/no-img-element -- an uploaded photo, any size */}
                    <img src={m.attachmentUrl} alt="Attached photo" className="max-h-64 rounded-xl" />
                  </a>
                ) : null}
                <p className={cx('mt-1 text-xs', mine ? 'text-white/70' : 'text-ink-3')}>{stamp(m.createdAt)}</p>
              </div>
            </div>
          );
        })}
        {t.status === 'new' || t.status === 'open' ? <p className="text-center text-sm text-ink-2">Trimmy&apos;s team will reply here. You&apos;ll get a notification.</p> : null}
        {t.status === 'waiting' ? (
          <div className="flex justify-center">
            <Button variant="secondary" size="sm" onClick={() => api<Ticket>(`/support/tickets/${ticketId}/resolve`, { method: 'POST' }).then(setData, (err) => toast.error(errorMessage(err)))}>
              That sorted it
            </Button>
          </div>
        ) : null}
        {sorted ? <p className="text-center text-sm text-ink-2">Marked sorted. Write below if you still need help.</p> : null}
      </section>

      <form onSubmit={send} className="flex flex-col gap-3 rounded-card border border-line p-4">
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} maxLength={5000} placeholder="Write a reply"
          className="w-full rounded-2xl border border-line-2 px-4 py-3 outline-none focus:border-ink focus:ring-4 focus:ring-accent-soft" />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label className="cursor-pointer text-sm font-semibold text-ink-2 hover:text-ink">
            {photo ? `📎 ${photo.name}` : 'Add a photo'}
            <input type="file" accept="image/jpeg,image/png" className="sr-only" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} />
          </label>
          <Button type="submit" loading={busy} disabled={!text.trim() && !photo}>Send</Button>
        </div>
      </form>
    </div>
  );
}
