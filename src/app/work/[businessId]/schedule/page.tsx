import type { Metadata } from 'next';
import { BookingFormPage } from '@/components/work-daily/booking-form-page';

export const metadata: Metadata = { title: 'New appointment' };

function one(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

// Presets from a link: ?date=&time=&staffId=&customerName=&customerPhone=&customerEmail=
export default async function SchedulePage({ searchParams }: PageProps<'/work/[businessId]/schedule'>) {
  const sp = await searchParams;
  return (
    <BookingFormPage
      mode="scheduled"
      preset={{
        date: one(sp.date),
        time: one(sp.time),
        staffId: one(sp.staffId),
        customerName: one(sp.customerName),
        customerPhone: one(sp.customerPhone),
        customerEmail: one(sp.customerEmail),
      }}
    />
  );
}
