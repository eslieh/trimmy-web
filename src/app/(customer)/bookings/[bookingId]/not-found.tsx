import { ButtonLink } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/misc';

export default function BookingNotFound() {
  return (
    <EmptyState
      title="Booking not found"
      body="It may belong to another account, or the link is incomplete."
      action={<ButtonLink href="/bookings">My bookings</ButtonLink>}
    />
  );
}
