import type { Metadata } from 'next';
import { requireOwner } from '@/lib/server/auth';
import { PaymentSettings } from '@/components/work-manage/settings/payment';

export const metadata: Metadata = { title: 'Payment details' };

export default async function Page({ params }: PageProps<'/work/[businessId]/settings/payment'>) {
  const { businessId } = await params;
  await requireOwner(businessId);
  return <PaymentSettings />;
}
