import Link from 'next/link';
import { getSession } from '@/lib/server/auth';
import { NotificationBell } from '@/components/notifications/bell';
import { LiveUpdates } from '@/components/notifications/live';
import { AccountMenu } from '@/components/shell/account-menu';
import { Logo } from '@/components/ui/misc';
import { buttonClass } from '@/components/ui/button';

// The customer site: a top bar (wordmark, Explore, My bookings, the bell and
// the account menu, or sign in), the page, and a footer with the legal links.
export default async function CustomerLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  const workplace = session?.workplaces[0];
  return (
    <LiveUpdates>
      <header className="sticky top-0 z-30 border-b border-ink/5 bg-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
          <Logo />
          <nav className="ml-4 hidden items-center gap-1 md:flex">
            <Link href="/" className="rounded-full px-4 py-2 text-sm font-medium text-ink-2 transition-colors hover:text-ink">Explore</Link>
            {session ? (
              <Link href="/bookings" className="rounded-full px-4 py-2 text-sm font-medium text-ink-2 transition-colors hover:text-ink">My bookings</Link>
            ) : null}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            {workplace ? (
              <Link
                href={workplace.status === 'published' || workplace.role !== 'owner' ? `/work/${workplace.businessId}` : `/setup/${workplace.businessId}`}
                className="hidden rounded-full px-4 py-2 text-sm font-semibold hover:bg-surface-2 sm:block"
              >
                {workplace.status === 'published' || workplace.role !== 'owner' ? `Switch to ${workplace.name}` : `Finish setting up ${workplace.name}`}
              </Link>
            ) : null}
            {session ? (
              <>
                <NotificationBell />
                <AccountMenu />
              </>
            ) : (
              <>
                <Link href="/login" className={buttonClass('ghost', 'sm')}>Log in</Link>
                <Link href="/signup" className={buttonClass('brand', 'sm')}>Sign up</Link>
              </>
            )}
          </div>
        </div>
      </header>
      <main className="mx-auto min-h-[70dvh] max-w-7xl px-4 py-6 sm:px-6 sm:py-8">{children}</main>
      <footer className="mt-12 border-t border-ink/5">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-8 text-sm text-ink-2 sm:px-6">
          <span>© {new Date().getFullYear()} Trimmy</span>
          <Link href="/legal/privacy" className="hover:text-ink">Privacy</Link>
          <Link href="/legal/terms" className="hover:text-ink">Terms</Link>
          <Link href="/account/help" className="hover:text-ink">Help</Link>
          <Link href="/setup" className="ml-auto font-semibold text-ink hover:underline">List your business</Link>
        </div>
      </footer>
    </LiveUpdates>
  );
}
