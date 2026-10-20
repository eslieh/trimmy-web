import type { Money } from './business';

export type BookingStatus =
  | 'pending_payment'
  | 'confirmed'
  | 'in_progress'
  | 'completed'
  | 'no_show'
  | 'cancelled';

// 'walk_in' bookings are created in-app by the business owner (Today tab
// "+") rather than through the customer-facing booking flow.
export type BookingSource = 'online' | 'walk_in';

// Tracks the final service charge collected via the "Charge customer" flow
// — separate from depositAmount, which (if any) is paid up front at booking
// time through the existing confirm-booking-payment flow.
export type PaymentStatus = 'unpaid' | 'deposit_paid' | 'paid';

// 'mpesa' sends an STK push to the customer's phone through the business's
// connected payment destination; 'cash' just records that cash changed
// hands in person, no push involved.
export type PaymentMethod = 'mpesa' | 'cash';

export type BookingServiceLine = {
  serviceId: string;
  name: string;
  durationMinutes: number;
  price: Money;
  quantity: number;
};

// The result of the C2 booking flow (Select Staff → Date & Time → Review &
// Policies → Payment). staffId null means "Any available" was chosen.
export type Booking = {
  bookingId: string;
  businessId: string;
  businessName: string;
  customerName: string;
  customerPhone: string | null; // set once a charge STK push has been sent, or entered up front for a scheduled/walk-in appointment
  customerEmail: string | null;
  // Linked to the customer's Trimmy account (matched by verified phone /
  // email): they see the booking in their app and get its notifications.
  customerHasAccount?: boolean;
  staffId: string | null;
  staffName: string;
  services: BookingServiceLine[];
  date: string; // 'YYYY-MM-DD'
  time: string; // 'HH:mm'
  durationMinutes: number;
  totalAmount: Money;
  depositAmount: Money | null; // null when the business requires no deposit
  status: BookingStatus;
  source: BookingSource;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod | null; // null until charged
  paymentReference: string | null; // M-Pesa receipt number once paid via mpesa; cash has no reference, stays null
  createdAt: string;
  // Server-created bookings (create-booking / get-booking) always carry the
  // fields below; they're optional only because the owner-side fulfillment
  // flows (walk-in, scheduled) are still mocked and build bookings locally.
  reference?: string; // short human code, e.g. BK7F3AQ9
  startsAt?: string; // date + time with the business's UTC offset
  expiresAt?: string | null; // pending_payment only: when the slot hold lapses
  cancelReason?: string | null; // e.g. payment_expired
  notes?: string | null;
  depositPayment?: DepositPayment | null; // null until a deposit payment is started (BK-31)
  depositPaid?: Money | null; // the deposit actually paid (BK-34); null if none / not yet
  tip?: Money | null; // paid with the checkout charge; went to the staff member's wallet
  // Checkout (charge-booking): what's left to pay after any deposit, and the
  // M-Pesa charge attempt once one is started.
  balanceDue?: Money | null;
  chargePayment?: DepositPayment | null;
  // Both null unless a cancellation involved money (BK-60).
  cancellationFee?: Money | null; // kept by the business for a late cancellation
  refund?: BookingRefund | null; // owed back to the customer, paid by the business by hand
  noShowFee?: NoShowFee | null; // set once the business marks it no_show (BK-64)
  review?: BookingReview | null; // the customer's review, once left (completed bookings only)
};

export type BookingReview = {
  reviewId: string;
  authorName: string; // first name + last initial
  rating: number; // 1–5
  text: string | null;
  createdAt: string;
};

// The business's noShow.feePercent of the total. With no card on file only
// a paid deposit can be kept: `kept` comes out of it (capped at it), any
// deposit left over becomes a refund owed, and the rest of the fee is
// `uncollected`.
export type NoShowFee = {
  percent: number;
  fee: Money;
  kept: Money;
  uncollected: Money;
};

export type BookingRefund = {
  amount: Money;
  status: 'due' | 'refunded';
  refundedAt: string | null;
  reference: string | null; // e.g. the refund's M-Pesa code
};

export type DepositPayment = {
  paymentId: string;
  status: 'pending' | 'succeeded' | 'failed' | 'timeout';
  failureReason: string | null;
  // BK-34: what was asked for; the M-Pesa receipt and time once it succeeded;
  // and where the money went (straight to the business, D1).
  amount?: Money;
  receipt?: string | null;
  paidAt?: string | null;
  destination?: { type: 'mpesa_till' | 'mpesa_paybill' | 'bank_account'; label: string } | null;
};
