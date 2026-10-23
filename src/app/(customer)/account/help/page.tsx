import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { buttonClass } from '@/components/ui/button';
import { Badge, PageHeader } from '@/components/ui/misc';
import { relativeTime } from '@/lib/format';
import { getSession } from '@/lib/server/auth';
import { serverApi } from '@/lib/server/api';
import { STATUS_LABEL, type TicketRow } from '@/types/support';

export const metadata: Metadata = { title: 'Help' };

// Help: questions to Trimmy's team and their answers.
export default async function HelpPage() {
  const session = await getSession();
  if (!session) redirect('/login?next=/account/help');
  const { tickets } = await serverApi<{ tickets: TicketRow[] }>('/support/tickets');

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Help"
        eyebrow="Account"
        subtitle="Ask about a booking, a payment or refund, your account or your business. Trimmy's team replies here, usually within a few hours."
        actions={<Link href="/account/help/new" className={buttonClass('primary')}>Ask a question</Link>}
      />
      {tickets.length ? (
        <ul className="flex flex-col gap-3">
          {tickets.map((t) => (
            <li key={t.id}>
              <Link href={`/account/help/${t.id}`} className="block rounded-card border border-line p-5 transition-shadow hover:shadow-card">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold">{t.subject}</p>
                  <span className="text-sm text-ink-3">{relativeTime(t.lastMessageAt)}</span>
                </div>
                <p className="mt-1 line-clamp-2 text-ink-2">{t.lastFrom === 'agent' ? 'Trimmy: ' : 'You: '}{t.preview}</p>
                <div className="mt-2"><Badge tone={t.status === 'waiting' ? 'brand' : t.status === 'resolved' || t.status === 'closed' ? 'success' : 'neutral'}>{STATUS_LABEL[t.status]}</Badge></div>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-card border border-line p-8 text-center text-ink-2">You haven&apos;t asked anything yet.</p>
      )}
    </div>
  );
}
