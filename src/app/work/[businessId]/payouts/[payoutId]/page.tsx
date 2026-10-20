import type { Metadata } from 'next';
import { requireOwner } from '@/lib/server/auth';
import { PayoutDetail } from '@/components/work-manage/payouts';

export const metadata: Metadata = { title: 'Payout' };

export default async function Page({ params }: PageProps<'/work/[businessId]/payouts/[payoutId]'>) {
  const { businessId, payoutId } = await params;
  await requireOwner(businessId);
  return <PayoutDetail key={payoutId} payoutId={payoutId} />;
}
