import type { Metadata } from 'next';
import { requireOwner } from '@/lib/server/auth';
import { SettingsHub } from '@/components/work-manage/settings/hub';

export const metadata: Metadata = { title: 'Settings' };

export default async function Page({ params }: PageProps<'/work/[businessId]/settings'>) {
  const { businessId } = await params;
  await requireOwner(businessId);
  return <SettingsHub />;
}
