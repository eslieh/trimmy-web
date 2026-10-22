import 'server-only';
import { cache } from 'react';
import { notFound, redirect } from 'next/navigation';
import type { MyBusiness, User } from '@/types/api';
import { serverApi } from './api';
import { getAccessToken } from './session';

export type Workplace = MyBusiness; // { businessId, name, role: owner|staff|front_desk, status, staffId? }

export type Session = {
  user: User;
  // Where they can use the business area (/work): businesses they own, or work
  // at as front desk. Staff use the mobile app; the web is for owners and desks.
  workplaces: Workplace[];
};

// The signed-in visitor, once per request (null when signed out or expired).
export const getSession = cache(async (): Promise<Session | null> => {
  if (!(await getAccessToken())) return null;
  try {
    const [user, businesses] = await Promise.all([
      serverApi<User>('/auth/me'),
      serverApi<{ businesses: MyBusiness[] }>('/me/businesses')
        .then((r) => r.businesses)
        .catch(() => [] as MyBusiness[]),
    ]);
    // The web is for running the business: owners, and anyone with front desk access
    // (desk-only, or staff who also run the desk).
    const workplaces = businesses.filter((b) => b.role === 'owner' || b.role === 'front_desk' || b.frontDeskAccess);
    return { user, workplaces };
  } catch {
    return null;
  }
});

// For owner-only pages under /work/[businessId] (earnings, team, payouts,
// settings): front desk get a 404 rather than a page that would fail anyway.
export async function requireOwner(businessId: string): Promise<Session> {
  const session = await getSession();
  if (!session) redirect(`/login?next=/work/${businessId}`);
  if (!session.workplaces.some((w) => w.businessId === businessId && w.role === 'owner')) notFound();
  return session;
}
