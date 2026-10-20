'use client';

import { Modal } from '@/components/ui/modal';
import type { Booking } from '@/types/booking';
import type { AppointmentPreset, WorkBusiness } from '@/types/work-daily';
import { BookingForm } from './booking-form';

// "New appointment" / "Walk-in" as a dialog over the current page.
export function BookingModal({
  mode, business, preset, today, onClose, onDone,
}: {
  mode: 'scheduled' | 'walk_in' | null; // null = closed
  business: WorkBusiness | null;
  preset?: AppointmentPreset;
  today: string;
  onClose: () => void;
  onDone: (booking: Booking) => void;
}) {
  return (
    <Modal open={!!mode && !!business} onClose={onClose} title={mode === 'walk_in' ? 'Walk-in' : 'New appointment'} wide>
      {mode && business ? (
        <div className="pb-3">
          <BookingForm
            // A fresh form for each opening (and each preset slot).
            key={`${mode}-${preset?.date}-${preset?.time}-${preset?.staffId}-${preset?.customerPhone}`}
            mode={mode}
            business={business}
            preset={preset}
            today={today}
            onCancel={onClose}
            onDone={onDone}
          />
        </div>
      ) : null}
    </Modal>
  );
}
