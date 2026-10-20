'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authAction } from '@/lib/api';
import type { User } from '@/types/api';
import type { MyBusiness } from '@/types/api';

export type Workplace = MyBusiness;
export type ClientSession = { user: User; workplaces: Workplace[] } | null;

type SessionContext = {
  session: ClientSession;
  // After signing in / changing details: re-read the session from the server.
  refresh: () => void;
  signOut: () => Promise<void>;
};

const Ctx = createContext<SessionContext | null>(null);

// The signed-in user and their workplaces, loaded on the server in the root
// layout (no flash of signed-out UI) and refreshed with router.refresh().
export function SessionProvider({ initial, children }: { initial: ClientSession; children: React.ReactNode }) {
  const router = useRouter();
  const [signedOut, setSignedOut] = useState(false);
  const session = signedOut ? null : initial;

  const refresh = useCallback(() => {
    setSignedOut(false);
    router.refresh();
  }, [router]);

  const signOut = useCallback(async () => {
    await authAction('logout').catch(() => {});
    setSignedOut(true);
    router.replace('/');
    router.refresh();
  }, [router]);

  const value = useMemo(() => ({ session, refresh, signOut }), [session, refresh, signOut]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession(): SessionContext {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useSession outside SessionProvider');
  return ctx;
}

export function displayName(user: User | null | undefined): string {
  if (!user) return 'Guest';
  return [user.first_name, user.last_name].filter(Boolean).join(' ') || user.email || 'You';
}
