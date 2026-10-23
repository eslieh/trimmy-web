import type { Metadata } from 'next';
import { VisitCheckout } from '@/components/work-daily/checkout';

export const metadata: Metadata = { title: 'Checkout' };

export default async function VisitCheckoutPage({ params }: PageProps<'/work/[businessId]/checkout/visit/[visitId]'>) {
  const { visitId } = await params;
  return <VisitCheckout visitId={visitId} />;
}
