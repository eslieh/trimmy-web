import type { Metadata } from 'next';
import { getSession } from '@/lib/server/auth';
import { ButtonLink } from '@/components/ui/button';
import { CheckIcon } from '@/components/customer/icons';

export const metadata: Metadata = {
  title: 'Trimmy for business',
  description: 'Online bookings, M-Pesa deposits, your team and your earnings: Trimmy for salons, barbershops and spas in Kenya.',
};

const FEATURES = [
  {
    title: 'Bookings around the clock',
    body: 'Customers find you on Trimmy, see your real availability and book in seconds, even while you sleep.',
  },
  {
    title: 'M-Pesa deposits that cut no-shows',
    body: 'Ask for a fixed or percentage deposit. Customers pay with an M-Pesa prompt, and the money goes straight to your till, paybill or bank.',
  },
  {
    title: 'Your whole team in one place',
    body: 'Invite stylists and front desk, set who does which services and which days they work, and let customers pick their favourite.',
  },
  {
    title: 'Earnings you can trust',
    body: 'See what came in each day, commission per staff member, tips, and payouts, without a notebook.',
  },
];

// A short pitch for salon owners. Setting a business up happens in the
// Trimmy mobile app for now; the web is for running it day to day.
export default async function ForBusinessPage() {
  const session = await getSession();
  const workplace = session?.workplaces.find((w) => w.role === 'owner') ?? session?.workplaces[0];
  return (
    <div className="flex flex-col gap-14 py-4">
      <section className="overflow-hidden rounded-sheet bg-brand-gradient px-6 py-12 text-white sm:px-12 sm:py-16">
        <p className="text-sm font-semibold uppercase tracking-wide text-white/80">Trimmy for business</p>
        <h1 className="mt-3 max-w-3xl text-3xl font-extrabold tracking-tight sm:text-5xl">Fill your chairs. Get paid on time. Spend less time on the phone.</h1>
        <p className="mt-4 max-w-2xl text-lg text-white/90">
          Trimmy gives salons, barbershops, nail bars and spas online booking, M-Pesa deposits, team scheduling and earnings in one place.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          {workplace ? (
            <ButtonLink href={`/work/${workplace.businessId}`} size="lg" variant="secondary" className="border-white">
              Open {workplace.name}
            </ButtonLink>
          ) : session ? (
            <ButtonLink href="#get-started" size="lg" variant="secondary" className="border-white">
              How to get started
            </ButtonLink>
          ) : (
            <>
              <ButtonLink href="/signup?next=/for-business" size="lg" variant="secondary" className="border-white">
                Create a free account
              </ButtonLink>
              <ButtonLink href="/login?next=/work" size="lg" variant="ghost" className="text-white hover:bg-white/15">
                I already have one: log in
              </ButtonLink>
            </>
          )}
        </div>
      </section>

      <section aria-labelledby="features-h">
        <h2 id="features-h" className="text-2xl font-extrabold tracking-tight sm:text-3xl">Everything you need to run the day</h2>
        <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <li key={f.title} className="rounded-card border border-line p-6">
              <span className="grid size-10 place-items-center rounded-full bg-brand/10 text-brand">
                <CheckIcon className="size-5" />
              </span>
              <h3 className="mt-4 text-lg font-bold">{f.title}</h3>
              <p className="mt-1 text-ink-2">{f.body}</p>
            </li>
          ))}
        </ul>
      </section>

      <section id="get-started" aria-labelledby="start-h" className="scroll-mt-24 rounded-card bg-surface-2 p-6 sm:p-10">
        <h2 id="start-h" className="text-2xl font-extrabold tracking-tight">How to get started</h2>
        <ol className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-3">
          <li>
            <p className="font-bold">1. Create your Trimmy account</p>
            <p className="mt-1 text-ink-2">Here on the web or in the app. It&apos;s the same account.</p>
          </li>
          <li>
            <p className="font-bold">2. Set up your business in the app</p>
            <p className="mt-1 text-ink-2">
              Business setup (photos, services, hours, policies and your M-Pesa payout details) happens in the Trimmy mobile app for now.
            </p>
          </li>
          <li>
            <p className="font-bold">3. Run it from anywhere</p>
            <p className="mt-1 text-ink-2">Once you&apos;re published, manage bookings, your team and earnings from the app or right here on the web.</p>
          </li>
        </ol>
        <p className="mt-6 text-sm text-ink-2">
          Questions? Email <a href="mailto:support@trimmy.com" className="font-semibold text-ink underline">support@trimmy.com</a>.
        </p>
      </section>
    </div>
  );
}
