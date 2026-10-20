import type { Metadata } from 'next';
import { requireOwner } from '@/lib/server/auth';
import { PayoutsPage } from '@/components/work-manage/payouts';

export const metadata: Metadata = { title: 'Payouts' };

export default async function Page({ params }: PageProps<'/work/[businessId]/payouts'>) {
  const { businessId } = await params;
  await requireOwner(businessId);
  return <PayoutsPage />;
}
