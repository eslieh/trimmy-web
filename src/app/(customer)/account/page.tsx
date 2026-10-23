import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/server/auth';
import { PageHeader } from '@/components/ui/misc';
import { PhotoForm } from '@/components/customer/account/photo-form';
import { SignOutButton } from '@/components/customer/account/account-forms';
import { ChevronRightIcon } from '@/components/customer/icons';
import { fullName } from '@/components/customer/labels';

export const metadata: Metadata = { title: 'Account' };

export default async function AccountPage() {
  const session = await getSession();
  if (!session) redirect('/login?next=/account');
  const { user, workplaces } = session;
  const name = fullName(user);
  const links = [
    { href: '/account/details', title: 'Personal details', body: 'Name and mobile number' },
    { href: '/account/password', title: 'Password', body: 'Change your password' },
    { href: '/account/notifications', title: 'Notifications', body: 'What we tell you about, and how' },
    { href: '/bookings', title: 'My bookings', body: 'Upcoming, past and cancelled appointments' },
    { href: '/account/reviews', title: 'My reviews', body: "Your reviews and the businesses' replies" },
    { href: '/account/help', title: 'Help', body: "Ask Trimmy's team, and see their answers" },
  ];
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Account" />
      <div className="mb-8 flex items-center gap-4 rounded-card border border-line p-5">
        <PhotoForm user={user} name={name}>
          <p className="truncate text-xl font-bold">{name}</p>
          <p className="truncate text-ink-2">{user.email ?? user.phone}</p>
          {user.email && user.phone ? <p className="truncate text-sm text-ink-2">{user.phone}</p> : null}
        </PhotoForm>
      </div>

      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {links.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="group flex h-full items-center justify-between gap-3 rounded-card border border-line p-5 transition-shadow hover:shadow-card">
              <span>
                <span className="block font-bold">{l.title}</span>
                <span className="block text-sm text-ink-2">{l.body}</span>
              </span>
              <ChevronRightIcon className="size-5 shrink-0 text-ink-3 group-hover:text-ink" />
            </Link>
          </li>
        ))}
      </ul>

      <div className="mt-8 rounded-card bg-surface-2 p-5">
        {workplaces.length ? (
          <>
            <p className="font-bold">Your businesses</p>
            <ul className="mt-2 flex flex-col gap-1">
              {workplaces.map((w) => (
                <li key={`${w.businessId}:${w.role}`}>
                  <Link href={`/work/${w.businessId}`} className="font-semibold text-brand hover:underline">
                    {w.name}
                  </Link>
                  <span className="ml-2 text-sm text-ink-2">{w.role === 'owner' ? 'Owner' : (w.role === 'staff' ? 'Staff + front desk' : 'Front desk')}</span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <>
            <p className="font-bold">Run a salon or barbershop?</p>
            <p className="mt-1 text-ink-2">
              Take bookings and M-Pesa deposits with Trimmy. <Link href="/setup" className="font-semibold text-ink underline">List your business</Link>
            </p>
          </>
        )}
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-line pt-6">
        <SignOutButton />
        <Link href="/account/delete" className="text-sm font-semibold text-danger hover:underline">
          Delete account
        </Link>
      </div>
    </div>
  );
}
