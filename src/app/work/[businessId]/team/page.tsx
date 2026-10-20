import type { Metadata } from 'next';
import { requireOwner } from '@/lib/server/auth';
import { TeamRoster } from '@/components/work-manage/team';

export const metadata: Metadata = { title: 'Team' };

export default async function TeamPage({ params }: PageProps<'/work/[businessId]/team'>) {
  const { businessId } = await params;
  await requireOwner(businessId);
  return <TeamRoster />;
}
