'use client';

import { createContext, useContext } from 'react';

export type WorkContextValue = {
  businessId: string;
  businessName: string;
  role: 'owner' | 'front_desk';
  // The signed-in person's Staff.id here (front desk always; owners who take clients).
  staffId: string | null;
};

const Ctx = createContext<WorkContextValue | null>(null);

export function WorkProvider({ value, children }: { value: WorkContextValue; children: React.ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

// The business this page is working on, and the visitor's role there.
export function useWork(): WorkContextValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useWork outside /work/[businessId]');
  return ctx;
}

export function workHref(businessId: string, path = ''): string {
  return `/work/${businessId}${path ? `/${path.replace(/^\//, '')}` : ''}`;
}
