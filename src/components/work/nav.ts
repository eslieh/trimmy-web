// The business area's pages, at /work/{businessId}/{href}. Front desk get the
// daily work; owners also get the business management section. Each page
// lives at src/app/work/[businessId]/<href>/page.tsx.
export type NavItem = { href: string; label: string; ownerOnly?: boolean };
export type NavSection = { title?: string; items: NavItem[] };

export const WORK_NAV: NavSection[] = [
  {
    items: [
      { href: 'today', label: 'Today' },
      { href: 'calendar', label: 'Calendar' },
      { href: 'bookings', label: 'Bookings' }, // list & search; also the unassigned / refunds-owed queues
      { href: 'customers', label: 'Customers' },
      { href: 'day-summary', label: 'Day summary' },
    ],
  },
  {
    title: 'Business',
    items: [
      { href: 'earnings', label: 'Earnings', ownerOnly: true },
      { href: 'team', label: 'Team', ownerOnly: true },
      { href: 'payouts', label: 'Payouts', ownerOnly: true },
      { href: 'settings', label: 'Settings', ownerOnly: true }, // services, hours, policies, info & photos, payment, booking rules
    ],
  },
];
