import type { Metadata } from 'next';
import { requireOwner } from '@/lib/server/auth';
import { PoliciesSettings } from '@/components/work-manage/settings/policies';

export const metadata: Metadata = { title: 'Policies' };

export default async function Page({ params }: PageProps<'/work/[businessId]/settings/policies'>) {
  const { businessId } = await params;
  await requireOwner(businessId);
  return <PoliciesSettings />;
}
