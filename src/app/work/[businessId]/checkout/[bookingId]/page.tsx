import type { Metadata } from 'next';
import { BookingCheckout } from '@/components/work-daily/checkout';

export const metadata: Metadata = { title: 'Checkout' };

export default async function CheckoutPage({ params }: PageProps<'/work/[businessId]/checkout/[bookingId]'>) {
  const { bookingId } = await params;
  return <BookingCheckout bookingId={bookingId} />;
}
