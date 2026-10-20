import type { Metadata } from 'next';
import { requireOwner } from '@/lib/server/auth';
import { EarningsDashboard } from '@/components/work-manage/earnings';

export const metadata: Metadata = { title: 'Earnings' };

// ?staffId= opens it scoped to one person (linked from their team page).
export default async function EarningsPage({ params, searchParams }: PageProps<'/work/[businessId]/earnings'>) {
  const { businessId } = await params;
  await requireOwner(businessId);
  const { staffId } = await searchParams;
  return <EarningsDashboard initialStaffId={typeof staffId === 'string' ? staffId : undefined} />;
}
