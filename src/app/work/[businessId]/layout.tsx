import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getSession } from '@/lib/server/auth';
import { NotificationBell } from '@/components/notifications/bell';
import { LiveUpdates } from '@/components/notifications/live';
import { AccountMenu } from '@/components/shell/account-menu';
import { WorkProvider } from '@/components/work/context';
import { WorkSidebar } from '@/components/work/sidebar';

// The business area for one business. Only its owner and front desk get in;
// owner-only pages check role again (see components/work/require-owner).
export default async function WorkLayout({ children, params }: LayoutProps<'/work/[businessId]'>) {
  const { businessId } = await params;
  const session = await getSession();
  if (!session) redirect(`/login?next=/work/${businessId}`);
  const workplace =
    session.workplaces.find((w) => w.businessId === businessId && w.role === 'owner') ??
    session.workplaces.find((w) => w.businessId === businessId);
  if (!workplace) notFound();
  if (workplace.role === 'owner' && workplace.status !== 'published') redirect(`/setup/${businessId}`);

  return (
    <WorkProvider
      value={{
        businessId,
        businessName: workplace.name,
        role: workplace.role === 'owner' ? 'owner' : 'front_desk',
        staffId: workplace.staffId,
      }}
    >
      <LiveUpdates>
        <div className="flex min-h-dvh bg-surface-2/50">
          <WorkSidebar />
          <div className="flex min-w-0 flex-1 flex-col">
            {/* On small screens WorkSidebar's menu button sits at the header's left. */}
            <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-line bg-white/95 pr-4 pl-18 backdrop-blur sm:pr-6 sm:pl-20 lg:pl-6">
              <p className="truncate font-bold lg:hidden">{workplace.name}</p>
              <div className="ml-auto flex items-center gap-2">
                <NotificationBell />
                <AccountMenu />
              </div>
            </header>
            {workplace.suspendedAt ? (
              // Paused by Trimmy's team: the owner's day keeps working, customers just can't find or book.
              <div role="status" className="border-b border-danger/20 bg-danger/5 px-4 py-3 text-sm sm:px-6">
                <p className="font-semibold text-danger">{workplace.name} is paused on Trimmy: customers can&apos;t find or book it online.</p>
                <p className="mt-0.5 text-ink-2">
                  {workplace.suspendedReason}{' '}
                  <Link href={`/account/help/new?businessId=${businessId}`} className="font-semibold text-ink underline">Talk to Trimmy&apos;s team</Link>
                </p>
              </div>
            ) : null}
            <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 sm:px-6 sm:py-8">{children}</main>
          </div>
        </div>
      </LiveUpdates>
    </WorkProvider>
  );
}
