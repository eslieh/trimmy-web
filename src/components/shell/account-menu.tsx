'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { displayName, useSession } from '@/components/session';
import { Avatar } from '@/components/ui/misc';

// The avatar menu in every area's header: account pages, switching between
// the customer site and a business, and signing out.
export function AccountMenu() {
  const { session, signOut } = useSession();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);
  if (!session) return null;
  const name = displayName(session.user);
  const item = 'block w-full rounded-lg px-3 py-2 text-left text-[15px] hover:bg-surface-2';
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open} className="flex items-center gap-2 rounded-full border border-line p-1 pr-3 hover:shadow-card">
        <Avatar name={name} size={30} />
        <span className="hidden max-w-32 truncate text-sm font-semibold sm:inline">{name}</span>
      </button>
      {open ? (
        <div role="menu" className="absolute right-0 z-40 mt-2 w-64 rounded-card border border-line bg-white p-2 shadow-raised" onClick={() => setOpen(false)}>
          <p className="px-3 pt-1 pb-2 text-xs text-ink-3">{session.user.email ?? session.user.phone}</p>
          <Link href="/bookings" className={item}>My bookings</Link>
          <Link href="/notifications" className={item}>Notifications</Link>
          <Link href="/account" className={item}>Account</Link>
          <div className="my-1 border-t border-line" />
          {session.workplaces.some((w) => w.role === 'owner') ? null : (
            <Link href="/setup" className={item}>List your business</Link>
          )}
          {session.workplaces.map((w) => (
            <Link
              key={`${w.businessId}:${w.role}`}
              href={w.role === 'owner' && w.status !== 'published' ? `/setup/${w.businessId}` : `/work/${w.businessId}`}
              className={item}
            >
              {w.name}
              <span className="ml-1 text-xs text-ink-3">
                {w.role === 'owner' ? (w.status === 'published' ? 'Owner' : 'Setup in progress') : 'Front desk'}
              </span>
            </Link>
          ))}
          <div className="my-1 border-t border-line" />
          <button onClick={signOut} className={`${item} text-danger`}>Log out</button>
        </div>
      ) : null}
    </div>
  );
}
