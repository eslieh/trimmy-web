import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { NewTicketForm } from '@/components/customer/help/new-ticket';
import { PageHeader } from '@/components/ui/misc';
import { getSession } from '@/lib/server/auth';

export const metadata: Metadata = { title: 'Ask a question' };

export default async function NewTicketPage({ searchParams }: PageProps<'/account/help/new'>) {
  const session = await getSession();
  const { bookingId, businessId } = await searchParams;
  if (!session) redirect('/login?next=/account/help/new');
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Ask a question" eyebrow="Help" />
      <NewTicketForm
        bookingId={typeof bookingId === 'string' ? bookingId : null}
        businessId={typeof businessId === 'string' ? businessId : null}
        businesses={session.workplaces.map((w) => ({ id: w.businessId, name: w.name }))}
      />
    </div>
  );
}
