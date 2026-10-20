// Types for the owner's business management pages (earnings, team, payouts,
// settings). Shapes follow the server's response models in
// server/app/modules/{earnings,business,payouts} and mobile's src/api.
import type { PaymentMethod } from './booking';
import type {
  BookingSettings,
  BusinessCategory,
  BusinessLocation,
  BusinessPhoto,
  BusinessPolicies,
  BusinessStatus,
  Money,
  OnboardingStep,
  PaymentDestination,
  Service,
  ServiceCategory,
  TeamMode,
  WeeklyHours,
} from './business';
import type { TeamRole } from './team';

// ─── Earnings (GET /businesses/{id}/earnings) ──────────────────

export type EarningsGranularity = 'hour' | 'day' | 'week' | 'month';

export type EarningsBucket = { label: string; amount: number; start: string; end: string; bookingsCount: number };

export type EarningsTransaction = {
  bookingId: string;
  serviceId: string | null;
  date: string;
  time: string;
  customerName: string;
  serviceName: string;
  amount: number;
  paymentMethod: PaymentMethod | null;
};

export type EarningsStaffRow = {
  staffId: string | null; // null = bookings nobody was assigned to
  name: string;
  amount: number;
  bookingsCount: number;
  commission: number;
};

export type EarningsMoney = {
  depositsCollected: number;
  cancellationFees: number;
  noShowFees: number;
  refundsDue: number;
  refundsPaid: number;
  // Paid with checkout charges and passed on to staff wallets: never revenue.
  tips: number;
  collected: { method: PaymentMethod; kind: 'deposit' | 'charge'; amount: number; count: number }[];
};

export type EarningsSummary = {
  totalRevenue: number;
  completed: number;
  noShow: number;
  cancelled: number;
  avgTicket: number;
  buckets: EarningsBucket[];
  paymentMethods: { method: PaymentMethod; amount: number; count: number }[];
  services: { serviceId: string | null; name: string; amount: number; bookingsCount: number }[];
  transactions: EarningsTransaction[];
  currency: string;
  from: string;
  to: string;
  timezone: string;
  staffId: string | null;
  granularity: EarningsGranularity;
  paidBookings: number;
  commission: number;
  transactionsTotal: number;
  staff: EarningsStaffRow[];
  money: EarningsMoney;
  previous: {
    from: string;
    to: string;
    totalRevenue: number;
    completed: number;
    avgTicket: number;
    revenueChangePercent: number | null;
  } | null;
};

// ─── Business (GET /businesses/{id}) ───────────────────────────

export type ServiceCategoryWithServices = ServiceCategory & { services: Service[] };

export type BusinessDetail = {
  businessId: string;
  name: string;
  description: string | null;
  categories: BusinessCategory[] | null;
  phone: string;
  location: BusinessLocation | null;
  amenities: string[] | null;
  photos: BusinessPhoto[] | null;
  // The server nests the hours one level down.
  workingHours: { weeklyHours: WeeklyHours } | null;
  serviceCategories: ServiceCategoryWithServices[];
  policies: BusinessPolicies | null;
  paymentDestination: PaymentDestination | null;
  teamMode: TeamMode | null;
  bookingSettings: BookingSettings | null;
  status: BusinessStatus;
  onboardingStep: OnboardingStep | null;
};

export type UpdateBusinessInfoInput = {
  name: string;
  description: string;
  categories: BusinessCategory[];
  phone: string;
  location: BusinessLocation;
  amenities: string[];
};

export type ServiceInput = { name: string; durationMinutes: number; price: Money };

export type PublishResult = { businessId: string; status: BusinessStatus; visible: boolean; publishedAt: string | null };

// ─── Team ──────────────────────────────────────────────────────

export type AddTeamMemberInput = {
  name: string;
  email?: string;
  phone?: string;
  role: TeamRole;
  commissionPercent: number;
  workingDays: (keyof WeeklyHours)[] | null;
};

// Keyed by staffId (accepted members only). allServices: true = every
// service, including ones added later; serviceIds must then be empty.
export type StaffServices = { allServices: boolean; serviceIds: string[] };

export type TimeOff = {
  timeOffId: string;
  staffId: string;
  staffName: string;
  date: string;
  until: string;
  start: string;
  end: string; // '24:00' for the end of the day
  allDay: boolean;
  reason: string | null;
};

export type CreateTimeOffInput =
  | { date: string; start: string; end: string; reason?: string }
  | { date: string; allDay: true; until?: string; reason?: string };
