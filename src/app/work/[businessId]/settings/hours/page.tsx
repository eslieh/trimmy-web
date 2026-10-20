import type { Metadata } from 'next';
import { requireOwner } from '@/lib/server/auth';
import { HoursSettings } from '@/components/work-manage/settings/hours';

export const metadata: Metadata = { title: 'Working hours' };

export default async function Page({ params }: PageProps<'/work/[businessId]/settings/hours'>) {
  const { businessId } = await params;
  await requireOwner(businessId);
  return <HoursSettings />;
}
