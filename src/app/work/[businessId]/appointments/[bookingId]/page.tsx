import type { Metadata } from 'next';
import { AppointmentPage } from '@/components/work-daily/appointment-page';

export const metadata: Metadata = { title: 'Appointment' };

export default async function Page({ params }: PageProps<'/work/[businessId]/appointments/[bookingId]'>) {
  const { bookingId } = await params;
  return <AppointmentPage bookingId={bookingId} />;
}
