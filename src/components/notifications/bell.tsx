'use client';

import Link from 'next/link';

// Placeholder until the notifications area lands: links to the inbox.
// (Replaced by the real bell with the unread badge and live updates.)
export function NotificationBell() {
  return (
    <Link href="/notifications" aria-label="Notifications" className="grid size-10 place-items-center rounded-full bg-surface-2 hover:bg-surface-3">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15L6 16z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        <path d="M10 21h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </Link>
  );
}
