import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { TicketThread } from '@/components/customer/help/ticket-thread';
import { getSession } from '@/lib/server/auth';

export const metadata: Metadata = { title: 'Help' };

export default async function TicketPage({ params }: PageProps<'/account/help/[ticketId]'>) {
  const { ticketId } = await params;
  if (!(await getSession())) redirect(`/login?next=/account/help/${ticketId}`);
  return <TicketThread ticketId={ticketId} />;
}
