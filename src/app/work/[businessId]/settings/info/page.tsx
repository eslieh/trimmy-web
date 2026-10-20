import type { Metadata } from 'next';
import { requireOwner } from '@/lib/server/auth';
import { InfoSettings } from '@/components/work-manage/settings/info';

export const metadata: Metadata = { title: 'Business info' };

export default async function Page({ params }: PageProps<'/work/[businessId]/settings/info'>) {
  const { businessId } = await params;
  await requireOwner(businessId);
  return <InfoSettings />;
}
