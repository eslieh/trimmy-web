'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ButtonArrow, buttonClass } from '@/components/ui/button';
import { Lightbox } from '@/components/ui/lightbox';
import { Avatar, Tabs } from '@/components/ui/misc';
import { Modal } from '@/components/ui/modal';
import { cx, money } from '@/lib/format';
import type { BusinessProfileService, BusinessProfileStaffMember } from '@/types/discovery';
import { CheckIcon, StarIcon } from '../icons';
import { useCart } from '../hooks';
import { DAYS, dayName, minutesLabel } from '../labels';
import { Photo } from '../photo';

type Member = BusinessProfileStaffMember;

// The business page's team: a tile per person; opening one shows their
// profile, the services they do (with Add, sharing the page's cart) and
// their portfolio, the web version of the mobile Staff Profile screen.
export function TeamList({ businessId, staff, services }: { businessId: string; staff: Member[]; services: BusinessProfileService[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const member = staff.find((s) => s.staffId === openId) ?? null;
  return (
    <>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {staff.map((s) => (
          <li key={s.staffId}>
            <button
              type="button"
              onClick={() => setOpenId(s.staffId)}
              className="group flex h-full w-full gap-4 rounded-3xl bg-ink/[0.03] p-5 text-left transition-colors hover:bg-accent-soft/60"
            >
              <Avatar name={s.name} src={s.avatarUrl} size={56} />
              <div className="min-w-0 flex-1">
                <p className="font-bold tracking-tight">{s.name}</p>
                <RoleLine member={s} />
                {s.specialties.length ? (
                  <ul className="mt-2 flex flex-wrap gap-1.5">
                    {s.specialties.slice(0, 3).map((sp) => (
                      <li key={sp} className="rounded-full bg-white px-2.5 py-0.5 text-xs font-medium">{sp}</li>
                    ))}
                  </ul>
                ) : null}
                <p className="mt-3 text-sm font-semibold text-ink-2 group-hover:text-ink">
                  {s.portfolio.length ? `See profile and ${s.portfolio.length} photos` : 'See profile'} →
                </p>
              </div>
            </button>
          </li>
        ))}
      </ul>
      {member ? <MemberSheet key={member.staffId} businessId={businessId} member={member} services={services} onClose={() => setOpenId(null)} /> : null}
    </>
  );
}

// Customers see the person (rating, what they're good at), never their role in the app.
function RoleLine({ member }: { member: Member }) {
  if (member.rating <= 0) return null;
  return (
    <p className="inline-flex items-center gap-0.5 text-sm font-semibold">
      <StarIcon className="size-3 text-brand-pink" /> {member.rating.toFixed(1)}
    </p>
  );
}

function MemberSheet({ businessId, member, services, onClose }: { businessId: string; member: Member; services: BusinessProfileService[]; onClose: () => void }) {
  const [tab, setTab] = useState<'profile' | 'portfolio'>('profile');
  const [viewing, setViewing] = useState<number | null>(null);
  const { ids, toggle } = useCart(businessId);
  const theirs = member.allServices ? services : services.filter((s) => member.serviceIds.includes(s.serviceId));
  const groups = new Map<string, BusinessProfileService[]>();
  for (const s of theirs) groups.set(s.categoryName, [...(groups.get(s.categoryName) ?? []), s]);
  const days = member.workingDays;
  const firstName = member.name.split(/\s+/)[0];

  return (
    <Modal
      open
      onClose={onClose}
      title={member.name}
      wide
      footer={
        <Link href={`/b/${businessId}/book?staff=${encodeURIComponent(member.staffId)}`} className={buttonClass('brand', 'lg', 'w-full justify-between pl-6', true)}>
          Book with {firstName}
          <ButtonArrow size="lg" />
        </Link>
      }
    >
      <div className="flex flex-col gap-6 pb-4">
        <div className="flex items-center gap-4">
          <Avatar name={member.name} src={member.avatarUrl} size={72} />
          <div className="min-w-0">
            <RoleLine member={member} />
            <p className="mt-1 text-sm text-ink-2">
              {days && days.length ? `Works ${DAYS.filter((d) => days.includes(d)).map((d) => dayName(d).slice(0, 3)).join(', ')}` : 'Works whenever the business is open'}
            </p>
          </div>
        </div>

        <Tabs
          value={tab}
          onChange={setTab}
          options={[
            { key: 'profile', label: 'Profile' },
            { key: 'portfolio', label: 'Portfolio', badge: member.portfolio.length || undefined },
          ]}
        />

        {tab === 'profile' ? (
          <div className="flex flex-col gap-6 animate-fade-in">
            {member.bio ? <p className="text-lg leading-relaxed tracking-tight">{member.bio}</p> : null}
            {member.specialties.length ? (
              <ul className="flex flex-wrap gap-2">
                {member.specialties.map((sp) => (
                  <li key={sp} className="flex items-center gap-2 rounded-full bg-ink/[0.04] px-4 py-2 text-sm font-medium">
                    <span className="size-1.5 rounded-full bg-brand-pink" aria-hidden />
                    {sp}
                  </li>
                ))}
              </ul>
            ) : null}
            <div>
              <p className="mb-3 text-sm font-semibold tracking-wide uppercase">Services by {firstName}</p>
              {theirs.length ? (
                <div className="flex flex-col gap-4">
                  {[...groups].map(([category, items]) => (
                    <div key={category}>
                      <p className="mb-2 text-sm text-ink-2">{category}</p>
                      <ul className="flex flex-col gap-2 rounded-3xl bg-ink/[0.03] p-2">
                        {items.map((s) => {
                          const added = ids.includes(s.serviceId);
                          return (
                            <li key={s.serviceId} className={cx('flex items-center justify-between gap-3 rounded-2xl bg-white p-4', added ? 'ring-2 ring-accent' : 'shadow-sm')}>
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
              ) : (
                <p className="rounded-3xl bg-ink/[0.03] p-6 text-ink-2">No services listed for {firstName} yet.</p>
              )}
            </div>
          </div>
        ) : member.portfolio.length ? (
          <ul className="grid grid-cols-2 gap-2 animate-fade-in sm:grid-cols-3">
            {member.portfolio.map((src, i) => (
              <li key={src + i}>
                <button
                  type="button"
                  onClick={() => setViewing(i)}
                  aria-label={`Open photo ${i + 1} of ${member.portfolio.length}`}
                  className="relative block aspect-square w-full overflow-hidden rounded-2xl bg-surface-3"
                >
                  <Photo src={src} alt="" sizes="(min-width: 640px) 220px, 50vw" className="transition-transform duration-500 hover:scale-[1.04]" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-3xl bg-ink/[0.03] p-6 text-ink-2">No portfolio photos yet.</p>
        )}
      </div>
      <Lightbox images={member.portfolio} index={viewing} onClose={() => setViewing(null)} label={`${member.name}'s work`} />
    </Modal>
  );
}
