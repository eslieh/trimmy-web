import type { BusinessCategory, BusinessPolicies, Money, WeeklyHours } from './business';

// Card shown in "near me" results / search results — a lighter projection
// of a business than the full profile, per reference/customer.md C1.
export type BusinessSummary = {
  businessId: string;
  name: string;
  categories: BusinessCategory[];
  thumbnailUrl: string;
  // Full photo set — search results render a swipeable carousel (Airbnb-
  // style), not just the single thumbnail. thumbnailUrl stays as photos[0]
  // for the compact grid card, which only ever shows one image.
  photos: string[];
  address: string;
  lat: number;
  lng: number;
  distanceKm: number;
  startingPrice: Money;
  rating: number;
  reviewCount: number;
};

export type BusinessProfileService = {
  serviceId: string;
  categoryName: string;
  name: string;
  durationMinutes: number;
  price: Money;
};

export type BusinessProfileStaffMember = {
  staffId: string;
  name: string;
  role: string;
  workingDays: (keyof WeeklyHours)[] | null; // null = whenever the business is open
  // true = performs every service (including ones added later);
  // false = exactly serviceIds.
  allServices: boolean;
  serviceIds: string[];
  rating: number;
  avatarUrl?: string;
  bio: string;
  specialties: string[];
  // Past work photos — no per-staff review text is modeled yet, so Staff
  // Profile's Reviews tab shows the business's own reviews as a stand-in.
  portfolio: string[];
};

// A review with who wrote it, who did the service, what was done and when, and
// the business's reply. Older reviews lack the staff and services.
export type BusinessProfileReview = {
  reviewId: string;
  authorName: string;
  authorAvatarUrl?: string | null;
  rating: number;
  text: string;
  createdAt: string;
  businessId?: string | null;
  businessName?: string | null;
  bookingId?: string | null;
  staffId?: string | null;
  staffName?: string | null;
  staffAvatarUrl?: string | null;
  services?: string[];
  visitDate?: string | null; // 'YYYY-MM-DD'
  reply?: { text: string; repliedAt: string } | null;
};

// GET /businesses/{id}/reviews, GET /me/reviews
export type ReviewPage = { reviews: BusinessProfileReview[]; total: number; averageRating: number };

// The full customer-facing profile — what C1's "tapping a result opens a
// business profile" and the Business Profile candidate screen need.
export type BusinessProfile = {
  businessId: string;
  name: string;
  description: string;
  categories: BusinessCategory[];
  photos: string[];
  rating: number;
  reviewCount: number;
  address: string;
  lat: number;
  lng: number;
  depositSummary: string;
  cancellationSummary: string;
  // Structured form of the two summaries above — the plain-language strings
  // are what the profile page shows, this is what the booking flow computes
  // real deposit amounts and available time slots from (see
  // src/utils/availability.ts). A real backend would return both.
  workingHours: WeeklyHours;
  policies: BusinessPolicies;
  amenities: string[];
  services: BusinessProfileService[];
  staff: BusinessProfileStaffMember[];
  reviews: BusinessProfileReview[];
};
