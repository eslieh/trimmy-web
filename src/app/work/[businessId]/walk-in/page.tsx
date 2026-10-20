import type { Metadata } from 'next';
import { BookingFormPage } from '@/components/work-daily/booking-form-page';

export const metadata: Metadata = { title: 'Walk-in' };

export default function WalkInPage() {
  return <BookingFormPage mode="walk_in" />;
}
