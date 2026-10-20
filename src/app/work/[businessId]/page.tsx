import { redirect } from 'next/navigation';

export default async function WorkHome({ params }: PageProps<'/work/[businessId]'>) {
  const { businessId } = await params;
  redirect(`/work/${businessId}/today`);
}
