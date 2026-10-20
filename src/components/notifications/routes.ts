import { toast } from '@/components/ui/toast';
import type { AppNotification } from '@/types/notification';
import { markRead } from './store';

// Where a notification opens on the web: the web twin of the mobile app's
// routeForNotification, so a toast, a bell row and an inbox row all go to
// the same page. null: nowhere better than the inbox itself.

const CUSTOMER_BOOKING = new Set([
  'booking_confirmed', 'booking_cancelled_by_business', 'booking_rescheduled_by_business', 'booking_payment_failed',
  'booking_hold_expired', 'booking_refund_due', 'booking_refunded', 'booking_no_show', 'booking_completed',
  'booking_reminder_24h', 'booking_reminder_2h',
]);

// Owner / front desk (and owners who take clients themselves).
const WORK_APPOINTMENT = new Set([
  'booking_created', 'booking_cancelled_by_customer', 'booking_rescheduled_by_customer',
  'booking_assigned', 'booking_cancelled_for_staff',
]);

const str = (v: unknown) => (typeof v === 'string' && v ? encodeURIComponent(v) : null);

export function routeForNotification(n: Pick<AppNotification, 'type' | 'data'>): string | null {
  const bookingId = str(n.data.bookingId);
  const businessId = str(n.data.businessId);
  const work = businessId ? `/work/${businessId}` : null;

  if (CUSTOMER_BOOKING.has(n.type)) return bookingId ? `/bookings/${bookingId}` : '/bookings';
  if (WORK_APPOINTMENT.has(n.type)) {
    if (!work) return null;
    return bookingId ? `${work}/appointments/${bookingId}` : work;
  }
  switch (n.type) {
    case 'booking_refund_owed': // mark it refunded from the bookings list
      return work ? `${work}/bookings?refund=due` : null;
    case 'payout_requested': {
      const payoutId = str(n.data.payoutId);
      if (!work) return null;
      return payoutId ? `${work}/payouts/${payoutId}` : `${work}/payouts`;
    }
    case 'day_summary_submitted': {
      const date = str(n.data.date);
      if (!work) return null;
      return date ? `${work}/day-summary?date=${date}` : `${work}/day-summary`;
    }
    case 'team_invitation':
      return '/account';
    case 'payout_responded':
    case 'wallet_adjusted': // staff earnings live in the mobile app
      return null;
    default:
      // A newer customer booking type this build doesn't know yet.
      if (n.type.startsWith('booking_') && bookingId && !businessId) return `/bookings/${bookingId}`;
      return null;
  }
}

// Shown under the row / toast for things that can only be finished in the app.
export function appOnlyHint(type: string): string | null {
  if (type === 'team_invitation') return 'Open the Trimmy app to accept.';
  if (type === 'payout_responded' || type === 'wallet_adjusted') return 'See your earnings in the Trimmy app.';
  return null;
}

// A click on a toast, bell row or inbox row: mark it read, then open its page.
// `fallback` is where to go when it has no page of its own (the inbox, from a
// toast or the bell; nowhere, from the inbox itself).
export function openNotification(n: AppNotification, push: (href: string) => void, fallback: string | null = '/notifications'): void {
  void markRead(n.notificationId);
  const hint = appOnlyHint(n.type);
  if (hint) toast(hint);
  const href = routeForNotification(n) ?? fallback;
  if (href) push(href);
}
