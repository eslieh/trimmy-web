'use client';

import Link from 'next/link';
import { ButtonArrow, buttonClass } from '@/components/ui/button';
import { Eyebrow } from '@/components/ui/misc';
import { cx, money } from '@/lib/format';
import type { BusinessProfileService } from '@/types/discovery';
import { CheckIcon } from '../icons';
import { useCart } from '../hooks';
import { minutesLabel } from '../labels';

// Services grouped by the owner's categories, each with Add / Added.
export function ServiceMenu({ businessId, services }: { businessId: string; services: BusinessProfileService[] }) {
  const { ids, toggle } = useCart(businessId);
  const groups = new Map<string, BusinessProfileService[]>();
  for (const s of services) groups.set(s.categoryName, [...(groups.get(s.categoryName) ?? []), s]);

  if (!services.length) return <p className="text-ink-2">This business hasn&apos;t listed any services yet.</p>;

  return (
    <div className="flex flex-col gap-8">
      {[...groups].map(([category, items]) => (
        <div key={category}>
          <h3 className="mb-3 text-lg font-bold tracking-tight">{category}</h3>
          <ul className="flex flex-col gap-2 rounded-3xl bg-ink/[0.03] p-2">
            {items.map((s) => {
              const added = ids.includes(s.serviceId);
              return (
                <li key={s.serviceId} className={cx('flex items-center justify-between gap-4 rounded-2xl bg-white p-4 transition-shadow', added ? 'ring-2 ring-accent' : 'shadow-sm')}>
                  <div className="min-w-0">
                    <p className="font-semibold tracking-tight">{s.name}</p>
                    <p className="text-sm text-ink-2">
                      {minutesLabel(s.durationMinutes)} · <span className="font-semibold text-ink">{money(s.price)}</span>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggle(s.serviceId)}
                    aria-pressed={added}
                    aria-label={added ? `Remove ${s.name}` : `Add ${s.name}`}
                    className={cx(buttonClass(added ? 'brand' : 'secondary', 'sm'), 'min-w-24')}
                  >
                    {added ? (
                      <>
                        <CheckIcon /> Added
                      </>
                    ) : (
                      'Add'
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

// The cart: a sticky card beside the profile on desktop, a bar along the
// bottom of the screen on phones.
export function CartPanel({ businessId, services, depositSummary }: { businessId: string; services: BusinessProfileService[]; depositSummary: string }) {
  const { ids, set } = useCart(businessId);
  const chosen = services.filter((s) => ids.includes(s.serviceId));
  const total = chosen.reduce((sum, s) => sum + s.price.amount, 0);
  const minutes = chosen.reduce((sum, s) => sum + s.durationMinutes, 0);
  const href = `/b/${businessId}/book`;

  return (
    <>
      <div className="hidden rounded-[2rem] bg-white p-6 shadow-raised ring-1 ring-ink/5 lg:block">
        <Eyebrow className="mb-4">Your booking</Eyebrow>
        {chosen.length ? (
          <>
            <p className="text-3xl font-bold tracking-tight">{money(total)}</p>
            <p className="text-sm text-ink-2">
              {chosen.length === 1 ? '1 service' : `${chosen.length} services`} · {minutesLabel(minutes)}
            </p>
            <ul className="my-4 flex flex-col gap-2 border-y border-ink/10 py-4 text-sm">
              {chosen.map((s) => (
                <li key={s.serviceId} className="flex justify-between gap-3">
                  <span>{s.name}</span>
                  <span className="font-semibold">{money(s.price)}</span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <>
            <p className="text-xl font-bold tracking-tight">Ready to book?</p>
            <p className="mt-1 mb-4 text-sm text-ink-2">Add services from the menu, then choose a time.</p>
          </>
        )}
        <Link href={href} className={buttonClass('brand', 'lg', 'w-full justify-between pl-6', true)}>
          {chosen.length ? 'Choose a time' : 'Book now'}
          <ButtonArrow size="lg" />
        </Link>
        {chosen.length ? (
          <button type="button" onClick={() => set([])} className="mt-3 w-full text-center text-sm font-semibold text-ink-2 hover:text-ink">
            Clear selection
          </button>
        ) : null}
        <p className="mt-4 text-[13px] text-ink-2">{depositSummary}</p>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-ink/5 bg-white px-4 py-3 lg:hidden" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4">
          <div className="min-w-0">
            {chosen.length ? (
              <>
                <p className="font-bold">{money(total)}</p>
                <p className="truncate text-sm text-ink-2">
                  {chosen.length === 1 ? '1 service' : `${chosen.length} services`} · {minutesLabel(minutes)}
                </p>
              </>
            ) : (
              <p className="text-sm text-ink-2">Pick services, then a time</p>
            )}
          </div>
          <Link href={href} className={buttonClass('brand', 'md', 'shrink-0', true)}>
            {chosen.length ? 'Choose a time' : 'Book now'}
            <ButtonArrow />
          </Link>
        </div>
      </div>
    </>
  );
}
