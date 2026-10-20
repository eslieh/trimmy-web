'use client';

import { useRouter } from 'next/navigation';
import { AppointmentPanel } from './appointment-panel';

// /appointments/[bookingId]: the appointment full page (phones open this
// from Today; any page can link here).
export function AppointmentPage({ bookingId }: { bookingId: string }) {
  const router = useRouter();
  return (
    <div>
      <button type="button" onClick={() => router.back()} className="mb-4 rounded-full px-3 py-1.5 text-sm font-semibold text-ink-2 hover:bg-surface-2 hover:text-ink">
        ← Back
      </button>
      <AppointmentPanel bookingId={bookingId} />
    </div>
  );
}
