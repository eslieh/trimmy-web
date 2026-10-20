'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Logo } from '@/components/ui/misc';
import { cx } from '@/lib/format';
import { WORK_NAV } from './nav';
import { useWork, workHref } from './context';

// The business area's navigation: a fixed sidebar on desktop, a drawer behind
// the menu button on smaller screens.
export function WorkSidebar() {
  const { businessId, businessName, role } = useWork();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const links = (
    <nav className="flex flex-col gap-6">
      {WORK_NAV.map((section, i) => {
        const items = section.items.filter((item) => !item.ownerOnly || role === 'owner');
        if (!items.length) return null;
        return (
          <div key={i} className="flex flex-col gap-1">
            {section.title ? <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-ink-3">{section.title}</p> : null}
            {items.map((item) => {
              const href = workHref(businessId, item.href);
              const active = pathname === href || pathname.startsWith(`${href}/`);
              return (
                <Link
                  key={item.href}
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  onClick={() => setOpen(false)} // the phone drawer closes on navigating
                  className={cx(
                    'rounded-xl px-3 py-2.5 text-[15px] font-semibold transition-colors',
                    active ? 'bg-ink text-white' : 'text-ink hover:bg-surface-2',
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        );
      })}
    </nav>
  );

  const header = (
    <div className="mb-6 flex flex-col gap-1 px-3">
      <Logo height={24} href={workHref(businessId, 'today')} />
      <p className="mt-3 truncate text-sm font-bold">{businessName}</p>
      <p className="text-xs text-ink-3">{role === 'owner' ? 'Owner' : 'Front desk'}</p>
    </div>
  );

  return (
    <>
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-line bg-white px-3 py-6 lg:flex">
        {header}
        <div className="flex-1 overflow-y-auto">{links}</div>
        <Link href="/" className="mt-4 rounded-xl px-3 py-2.5 text-sm font-semibold text-ink-2 hover:bg-surface-2">
          ← Back to Trimmy
        </Link>
      </aside>
      <button
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        className="fixed top-3 left-4 z-40 grid size-10 place-items-center rounded-full bg-surface-2 sm:left-6 lg:hidden"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 bg-black/40 lg:hidden" onClick={() => setOpen(false)}>
          <aside className="h-full w-72 overflow-y-auto bg-white px-3 py-6" onClick={(e) => e.stopPropagation()}>
            {header}
            {links}
            <Link href="/" className="mt-6 block rounded-xl px-3 py-2.5 text-sm font-semibold text-ink-2 hover:bg-surface-2">
              ← Back to Trimmy
            </Link>
          </aside>
        </div>
      ) : null}
    </>
  );
}
