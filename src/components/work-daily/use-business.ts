'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { useWork, type WorkContextValue } from '@/components/work/context';
import type { BookingSettings, Money, WeeklyHours } from '@/types/business';
import type { BusinessProfile } from '@/types/discovery';
import type { WorkBusiness } from '@/types/work-daily';
import { DEFAULT_TIMEZONE } from './time';

// GET /businesses/{id} (owner only): what this hook uses from it.
type OwnerBusiness = {
  businessId: string;
  name: string;
  workingHours?: { weeklyHours: WeeklyHours } | null;
  serviceCategories?: {
    categoryId: string;
    name: string;
    services: { serviceId: string; name: string; durationMinutes: number; price: Money }[];
  }[];
  bookingSettings?: BookingSettings | null;
};

const EMPTY_HOURS: WeeklyHours = {
  monday: null, tuesday: null, wednesday: null, thursday: null, friday: null, saturday: null, sunday: null,
};

// One load per business per page session: every daily-work page needs the
// same hours, services and staff, and they rarely change mid-shift.
const cache = new Map<string, Promise<WorkBusiness>>();

async function load({ businessId, role, staffId }: WorkContextValue): Promise<WorkBusiness> {
  // Front desk can't use the owner endpoints, so both roles read the public
  // profile (it lists every staff record with their services); owners also
  // get booking settings and, for an unpublished business, the draft.
  const [profile, owned] = await Promise.all([
    api<BusinessProfile>(`/businesses/${businessId}/profile`).catch((err: unknown) => err),
    role === 'owner' ? api<OwnerBusiness>(`/businesses/${businessId}`).catch(() => null) : Promise.resolve(null),
  ]);
  const timezone = owned?.bookingSettings?.timezone ?? DEFAULT_TIMEZONE;

  if (!(profile instanceof Error) && profile) {
    const p = profile as BusinessProfile;
    return {
      businessId,
      name: p.name,
      timezone,
      workingHours: owned?.workingHours?.weeklyHours ?? p.workingHours ?? EMPTY_HOURS,
      bookingSettings: owned?.bookingSettings ?? null,
      services: p.services.map((s) => ({ ...s })),
      staff: p.staff.map((m) => ({
        staffId: m.staffId,
        name: m.staffId === staffId ? `${m.name} (you)` : m.name,
        avatarUrl: m.avatarUrl ?? null,
        bookable: m.allServices || m.serviceIds.length > 0,
        allServices: m.allServices,
        serviceIds: m.serviceIds,
        workingDays: m.workingDays,
      })),
    };
  }

  // Not published yet (the profile is 404): the owner's draft, with the
  // owner as the only person to book.
  if (owned) {
    return {
      businessId,
      name: owned.name,
      timezone,
      workingHours: owned.workingHours?.weeklyHours ?? EMPTY_HOURS,
      bookingSettings: owned.bookingSettings ?? null,
      services: (owned.serviceCategories ?? []).flatMap((c) =>
        c.services.map((s) => ({ serviceId: s.serviceId, categoryName: c.name, name: s.name, durationMinutes: s.durationMinutes, price: s.price })),
      ),
      staff: staffId
        ? [{ staffId, name: 'You', avatarUrl: null, bookable: true, allServices: true, serviceIds: [], workingDays: null }]
        : [],
    };
  }
  throw profile instanceof ApiError ? profile : new ApiError(500, 'unknown_error', "Couldn't load this business.");
}

export function useBusiness() {
  const { businessId, businessName, role, staffId } = useWork();
  const [state, setState] = useState<{ business: WorkBusiness | null; error: unknown }>({ business: null, error: null });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let current = true;
    let promise = cache.get(businessId);
    if (!promise) {
      promise = load({ businessId, businessName, role, staffId });
      cache.set(businessId, promise);
      promise.catch(() => cache.delete(businessId));
    }
    promise.then(
      (business) => current && setState({ business, error: null }),
      (error) => current && setState({ business: null, error }),
    );
    return () => {
      current = false;
    };
  }, [businessId, businessName, role, staffId, version]);

  const reload = useCallback(() => {
    cache.delete(businessId);
    setVersion((v) => v + 1);
  }, [businessId]);

  return { business: state.business, error: state.error, reload };
}

// Who a booking can be given to: people who perform every one of its services.
export function staffForServices(business: WorkBusiness, serviceIds: string[]) {
  return business.staff.filter((m) => m.bookable && (m.allServices || serviceIds.every((id) => m.serviceIds.includes(id))));
}
