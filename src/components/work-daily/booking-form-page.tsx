'use client';

import { useRouter } from 'next/navigation';
import { Card, PageHeader } from '@/components/ui/misc';
import { useWork, workHref } from '@/components/work/context';
import type { AppointmentPreset } from '@/types/work-daily';
import { Loading, LoadError } from './bits';
import { BookingForm } from './booking-form';
import { useBusinessClock } from './hooks';
import { useBusiness } from './use-business';

// /walk-in and /schedule: the same form as Today's dialogs, as a page (for
// links, e.g. a customer's "New appointment", and for phones).
export function BookingFormPage({ mode, preset }: { mode: 'scheduled' | 'walk_in'; preset?: AppointmentPreset }) {
  const router = useRouter();
  const { businessId } = useWork();
  const { business, error, reload } = useBusiness();
  const now = useBusinessClock(business?.timezone);

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title={mode === 'walk_in' ? 'Walk-in' : 'New appointment'}
        subtitle={mode === 'walk_in' ? 'The customer is here now: it starts straight away.' : 'Book a customer in for later.'}
      />
      <Card>
        {business ? (
          <BookingForm
            mode={mode}
            business={business}
            preset={preset}
            today={now.date}
            onCancel={() => router.back()}
            onDone={(b) => router.replace(workHref(businessId, `appointments/${b.bookingId}`))}
          />
        ) : error ? (
          <LoadError error={error} onRetry={reload} title="Couldn't load the business" />
        ) : (
          <Loading />
        )}
      </Card>
    </div>
  );
}
