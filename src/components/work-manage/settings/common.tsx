'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useWork, workHref } from '@/components/work/context';
import { cx } from '@/lib/format';
import type { BusinessDetail } from '@/types/work-manage';
import { ErrorBlock, Loading } from '../shared';
import { useApi } from '../use-api';

export const SETTINGS_SECTIONS: { href: string; label: string; blurb: string }[] = [
  { href: 'info', label: 'Business info', blurb: 'Name, description, categories, phone, location and amenities' },
  { href: 'photos', label: 'Photos', blurb: 'What customers see first' },
  { href: 'services', label: 'Services', blurb: 'Your menu: categories, prices and durations' },
  { href: 'hours', label: 'Working hours', blurb: 'When you are open each week' },
  { href: 'booking-rules', label: 'Booking rules', blurb: 'Start times, buffers, lead time and how far ahead' },
  { href: 'policies', label: 'Policies', blurb: 'Deposits, cancellations and no-shows' },
  { href: 'payment', label: 'Payment details', blurb: 'Where customer payments go: M-Pesa or bank' },
];

// The settings sub-navigation: a sideways-scrolling row on phones, a list on desktop.
export function SettingsNav() {
  const { businessId } = useWork();
  const pathname = usePathname();
  const root = workHref(businessId, 'settings');
  const items = [{ href: '', label: 'Overview' }, ...SETTINGS_SECTIONS];
  return (
    <nav aria-label="Settings" className="-mx-4 overflow-x-auto px-4 lg:mx-0 lg:overflow-visible lg:px-0">
      <ul className="flex gap-2 lg:flex-col lg:gap-1">
        {items.map((s) => {
          const href = s.href ? `${root}/${s.href}` : root;
          const active = s.href ? pathname === href || pathname.startsWith(`${href}/`) : pathname === root;
          return (
            <li key={s.href || 'overview'} className="shrink-0">
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cx(
                  'block whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition-colors lg:rounded-xl lg:px-3 lg:py-2.5',
                  active ? 'bg-ink text-white' : 'bg-surface-3 text-ink hover:bg-line lg:bg-transparent lg:hover:bg-surface-3',
                )}
              >
                {s.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function useBusiness() {
  const { businessId } = useWork();
  return useApi<BusinessDetail>(`/businesses/${businessId}`);
}

// Header + loading / error handling for a settings page that edits part of
// the business. `children` only renders once the business has loaded.
export function SettingsSection({
  title, subtitle, children,
}: {
  title: string;
  subtitle?: string;
  children: (business: BusinessDetail, reload: () => void) => React.ReactNode;
}) {
  const { data, error, reload } = useBusiness();
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{title}</h1>
        {subtitle ? <p className="mt-1 text-ink-2">{subtitle}</p> : null}
      </div>
      {data ? children(data, reload) : error ? <ErrorBlock message={error} onRetry={reload} /> : <Loading />}
    </div>
  );
}

// A sticky save row for forms: stays in reach on long pages.
export function SaveBar({ dirty, saving, onReset, label = 'Save changes', disabled }: { dirty: boolean; saving: boolean; onReset?: () => void; label?: string; disabled?: boolean }) {
  return (
    <div className="sticky bottom-0 z-10 -mx-4 flex items-center justify-end gap-2 border-t border-line bg-white/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-card sm:border sm:shadow-card">
      {dirty ? <p className="mr-auto text-sm text-ink-2">Unsaved changes</p> : null}
      {dirty && onReset ? (
        <Button type="button" variant="ghost" onClick={onReset} disabled={saving}>
          Discard
        </Button>
      ) : null}
      <Button type="submit" loading={saving} disabled={!dirty || disabled}>
        {label}
      </Button>
    </div>
  );
}

export const BUSINESS_CATEGORIES = [
  { value: 'hair_salon', label: 'Hair Salon' },
  { value: 'barbershop', label: 'Barbershop' },
  { value: 'nail_salon', label: 'Nail Salon' },
  { value: 'spa', label: 'Spa' },
  { value: 'beauty', label: 'Beauty' },
  { value: 'other', label: 'Other' },
] as const;

// Free-form on the server and shown verbatim to customers (mobile data/amenities.ts).
export const AMENITIES = [
  'Free WiFi', 'Air conditioning', 'Parking available', 'Wheelchair accessible', 'Card payment accepted',
  'M-Pesa accepted', 'TV', 'Refreshments', 'Showers', 'Kids friendly',
];

export function SettingsLink({ href, children }: { href: string; children: React.ReactNode }) {
  const { businessId } = useWork();
  return (
    <Link href={workHref(businessId, `settings/${href}`)} className="font-semibold text-brand hover:underline">
      {children}
    </Link>
  );
}
