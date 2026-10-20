import type { Booking, BookingStatus, PaymentMethod } from '@/types/booking';

// One status vocabulary for every daily-work page (same words as mobile's
// utils/bookingStatus).
export const STATUS_LABEL: Record<BookingStatus, string> = {
  pending_payment: 'Payment pending',
  confirmed: 'Confirmed',
  in_progress: 'In progress',
  completed: 'Completed',
  no_show: 'No-show',
  cancelled: 'Cancelled',
};

export const STATUS_TONE: Record<BookingStatus, 'neutral' | 'success' | 'warning' | 'danger' | 'brand'> = {
  pending_payment: 'warning',
  confirmed: 'success',
  in_progress: 'brand',
  completed: 'neutral',
  no_show: 'danger',
  cancelled: 'danger',
};

// Grid blocks: a coloured left edge and a tinted body per status.
export const STATUS_BLOCK: Record<BookingStatus, string> = {
  pending_payment: 'border-l-warning bg-warning/10',
  confirmed: 'border-l-success bg-success/10',
  in_progress: 'border-l-brand bg-brand/10',
  completed: 'border-l-line-3 bg-surface-3 text-ink-2',
  no_show: 'border-l-danger bg-danger/10',
  cancelled: 'border-l-danger bg-surface-2 line-through text-ink-3',
};

export const STATUS_DOT: Record<BookingStatus, string> = {
  pending_payment: 'bg-warning',
  confirmed: 'bg-success',
  in_progress: 'bg-brand',
  completed: 'bg-line-3',
  no_show: 'bg-danger',
  cancelled: 'bg-danger',
};

export const ALL_STATUSES: BookingStatus[] = ['pending_payment', 'confirmed', 'in_progress', 'completed', 'no_show', 'cancelled'];

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = { mpesa: 'M-Pesa', cash: 'Cash' };

// chargePayment / depositPayment failureReason, as the front desk reads it.
const FAILURE: Record<string, string> = {
  cancelled: 'The customer dismissed the M-Pesa prompt.',
  insufficient_funds: "Their M-Pesa balance wasn't enough.",
  wrong_pin: 'The M-Pesa PIN entered was wrong.',
  timeout: 'The M-Pesa prompt timed out before a PIN was entered.',
  busy: 'Another M-Pesa transaction was in progress on their phone.',
  provider_error: "M-Pesa couldn't complete the payment.",
  failed: "The payment didn't go through.",
};

export function failureMessage(reason: string | null | undefined): string {
  return (reason && FAILURE[reason]) || FAILURE.failed;
}

// Still on the books: not cancelled.
export function isActive(b: Booking): boolean {
  return b.status !== 'cancelled';
}

export function servicesLabel(b: Booking): string {
  return b.services.map((s) => (s.quantity > 1 ? `${s.quantity}× ${s.name}` : s.name)).join(', ');
}

// What's still to collect at checkout.
export function needsCharge(b: Booking): boolean {
  return b.status === 'in_progress' || (b.status === 'completed' && b.paymentStatus !== 'paid');
}
