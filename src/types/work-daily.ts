import type { Booking } from './booking';
import type { BookingSettings, Money, WeeklyHours } from './business';
import type { Customer } from './customer';

// Types for the business area's daily work (Today, Calendar, Bookings,
// Appointment, Customers, Day summary) that aren't in the shared copies.

// The business as the daily-work pages need it, in one shape for owners
// (GET /businesses/{id}) and front desk (GET /businesses/{id}/profile).
export type WorkService = {
  serviceId: string;
  categoryName: string;
  name: string;
  durationMinutes: number;
  price: Money;
};

export type WorkStaff = {
  staffId: string;
  name: string;
  avatarUrl: string | null;
  // Performs at least one service, so bookings can be given to them.
  bookable: boolean;
  allServices: boolean;
  serviceIds: string[];
  workingDays: (keyof WeeklyHours)[] | null;
};

export type WorkBusiness = {
  businessId: string;
  name: string;
  timezone: string;
  workingHours: WeeklyHours;
  bookingSettings: BookingSettings | null; // owners only
  services: WorkService[];
  staff: WorkStaff[];
};

// reference/api/team.json#list-time-off
export type TimeOff = {
  timeOffId: string;
  staffId: string;
  staffName: string;
  date: string; // 'YYYY-MM-DD'
  until: string; // last day; same as date unless it spans days
  start: string; // 'HH:mm'
  end: string; // 'HH:mm', '24:00' for the end of the day
  allDay: boolean;
  reason: string | null;
};

export type CreateTimeOffInput =
  | { date: string; start: string; end: string; reason?: string }
  | { date: string; allDay: true; until?: string; reason?: string };

// reference/api/booking.json#get-availability
export type AvailabilitySlot = { time: string; startsAt: string; staffIds: string[] };
export type Availability = { date: string; timezone: string; durationMinutes: number; slots: AvailabilitySlot[] };

// reference/api/fulfillment.json#get-day-summary
export type AmountCount = { amount: number; count: number };

export type DaySummary = {
  date: string;
  timezone: string;
  appointments: number;
  walkIns: number;
  completed: number;
  noShows: number;
  cancelled: number;
  // The drawer, split by method and (separately) by kind: the same money twice, never add them.
  collected: {
    cash: AmountCount;
    mpesa: AmountCount;
    depositsCollected: AmountCount;
    balancePayments: AmountCount;
    tips?: AmountCount; // inside cash / M-Pesa; owed to staff, already in their wallets
  };
  refundsPaid: AmountCount;
  unpaid: { bookingId: string; customerName: string; time: string; status?: string; balanceDue: Money }[];
  submission: { submittedAt: string | null; submittedBy: string | null; notes: string | null };
};

export type CustomersPage = { customers: Customer[]; total: number };
export type BookingsPage = { bookings: Booking[] };

// POST /bookings/{id}/charge with M-Pesa: 202 with the prompt; cash (or nothing left to pay) is the Booking.
export type ChargeStarted = {
  paymentId: string;
  bookingId: string;
  status: 'pending';
  amount: number;
  currency: 'KES';
  phone: string;
  customerMessage: string;
};

// Presets passed to the New appointment form (from a grid slot, a customer, a calendar time).
export type AppointmentPreset = {
  date?: string;
  time?: string;
  staffId?: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
};

// GET /visits/{visitId}: one customer's visit across several bookings (and staff),
// checked out and tipped together.
export type Visit = {
  visitId: string;
  businessId: string;
  customerName: string;
  customerPhone: string | null;
  bookings: Booking[]; // soonest first; cancelled / no-show listed but not counted
  staff: { staffId: string | null; staffName: string; staffAvatarUrl?: string | null; subtotal: Money; balanceDue: Money; bookingIds: string[] }[];
  total: Money;
  depositPaid: Money;
  balanceDue: Money;
  paymentStatus: 'unpaid' | 'partially_paid' | 'paid';
  chargeableBookingIds: string[];
  notReady: { bookingId: string; status: string; staffName: string }[];
  chargePayment: Booking['chargePayment'] | null;
};
