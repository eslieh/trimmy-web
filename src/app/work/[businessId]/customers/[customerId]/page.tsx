import type { Metadata } from 'next';
import { CustomerDetail } from '@/components/work-daily/customer-detail';

export const metadata: Metadata = { title: 'Customer' };

export default async function CustomerPage({ params }: PageProps<'/work/[businessId]/customers/[customerId]'>) {
  const { customerId } = await params;
  return <CustomerDetail customerId={customerId} />;
}
