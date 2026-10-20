// The icon for a notification type, shared by the bell preview and the inbox
// so the same kind always looks the same.
const PATHS = {
  clock: 'M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z',
  calendar: 'M8 3v3M16 3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z',
  wallet: 'M4 7h15a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7zm0 0V6a2 2 0 0 1 2-2h10M16 13h1',
  chart: 'M5 20V10M12 20V4M19 20v-7',
  users: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM3 20c0-3 2.7-5 6-5s6 2 6 5M16 4.5a3.5 3.5 0 0 1 0 6.5M18 15c2 .6 3 2.2 3 5',
  bell: 'M6 16v-5a6 6 0 0 1 12 0v5l1.5 2h-15L6 16zM10 21h4',
} as const;

function kind(type: string): keyof typeof PATHS {
  if (type.startsWith('booking_reminder')) return 'clock';
  if (type.startsWith('booking_')) return 'calendar';
  if (type.startsWith('payout_') || type === 'wallet_adjusted') return 'wallet';
  if (type === 'day_summary_submitted') return 'chart';
  if (type === 'team_invitation') return 'users';
  return 'bell';
}

export function NotificationIcon({ type, size = 18 }: { type: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d={PATHS[kind(type)]} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
