import 'server-only';
import { cache } from 'react';
import { notFound } from 'next/navigation';
import { ServerApiError, serverApi } from '@/lib/server/api';
import type { Booking } from '@/types/booking';
import type { BusinessProfile } from '@/types/discovery';

// Server-side reads shared by the customer pages. cache() lets a page and its
// generateMetadata share one fetch per request.

// Public and the same for everyone, so cached for a minute (prices are
// re-checked when booking: create-booking takes expectedTotal).
export const getProfile = cache(async (businessId: string): Promise<BusinessProfile | null> => {
  try {
    return await serverApi<BusinessProfile>(`/businesses/${encodeURIComponent(businessId)}/profile`, { auth: false, revalidate: 60 });
  } catch (err) {
    if (err instanceof ServerApiError && (err.status === 404 || err.status === 422)) return null;
    throw err;
  }
});

// A booking the signed-in customer can see: 404 (or someone else's) → not found.
export const getBookingOr404 = cache(async (bookingId: string): Promise<Booking> => {
  try {
    return await serverApi<Booking>(`/bookings/${encodeURIComponent(bookingId)}`);
  } catch (err) {
    if (err instanceof ServerApiError && [403, 404, 422].includes(err.status)) notFound();
    throw err;
  }
});
