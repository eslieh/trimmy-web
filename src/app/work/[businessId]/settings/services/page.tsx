import type { Metadata } from 'next';
import { requireOwner } from '@/lib/server/auth';
import { ServicesSettings } from '@/components/work-manage/settings/services';

export const metadata: Metadata = { title: 'Services' };

export default async function Page({ params }: PageProps<'/work/[businessId]/settings/services'>) {
  const { businessId } = await params;
  await requireOwner(businessId);
  return <ServicesSettings />;
}
