import type { Booking } from './booking';
import type { Money } from './business';
import type { BusinessSummary } from './discovery';

// Customer-site shapes not in the shared types (copied from mobile/src/api/*.ts,
// see mobile/reference/api/booking.json and discovery.json).

export type AvailabilityDay = {
  date: string; // YYYY-MM-DD, business local
  isOpen: boolean;
  hasSlots: boolean;
};

export type AvailabilityDays = { timezone: string; durationMinutes: number; days: AvailabilityDay[] };

export type AvailabilitySlot = {
  time: string; // HH:MM, business local: show as-is
  startsAt: string;
  staffIds: string[];
};

export type AvailabilityForDay = { date: string; timezone: string; durationMinutes: number; slots: AvailabilitySlot[] };

export type MyBookingsFilter = 'upcoming' | 'past' | 'cancelled';
export type MyBookingsPage = { bookings: Booking[]; nextCursor: string | null };

export type CancelPreview = {
  bookingId: string;
  canCancel: boolean;
  reasonBlocked: string | null;
  freeUntil: string;
  withinFreeWindow: boolean;
  depositPaid: Money;
  fee: Money;
  refund: Money;
  lateFeePercent: number;
  message: string; // show as-is
};

export type StartPaymentResult = {
  paymentId: string;
  bookingId: string;
  status: 'pending';
  amount: number;
  currency: 'KES';
  phone: string;
  customerMessage: string;
  expiresAt: string | null;
};

export type FavoriteStaff = {
  staffId: string;
  name: string;
  businessId: string;
  businessName: string;
  avatarUrl: string | null;
  role: string;
  rating: number;
};

export type Favorites = { businesses: BusinessSummary[]; staff: FavoriteStaff[] };

export type SearchResponse = { businesses: BusinessSummary[] };
