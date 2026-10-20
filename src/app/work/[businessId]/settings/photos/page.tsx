import type { Metadata } from 'next';
import { requireOwner } from '@/lib/server/auth';
import { PhotosSettings } from '@/components/work-manage/settings/photos';

export const metadata: Metadata = { title: 'Photos' };

export default async function Page({ params }: PageProps<'/work/[businessId]/settings/photos'>) {
  const { businessId } = await params;
  await requireOwner(businessId);
  return <PhotosSettings />;
}
