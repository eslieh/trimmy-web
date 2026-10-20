import type { Money } from '@/types/business';

// Shared formatting, so every page writes money and times the same way.

export function money(value: Money | number | null | undefined, currency = 'KES'): string {
  if (value === null || value === undefined) return '';
  const amount = typeof value === 'number' ? value : value.amount;
  const cur = typeof value === 'number' ? currency : value.currency || currency;
  return `${cur === 'KES' ? 'KSh' : cur} ${amount.toLocaleString('en-US')}`;
}

// 'YYYY-MM-DD' (a business-local date) → 'Tue 21 Oct'. Parsed as a local date, never UTC.
export function dayLabel(dateKey: string, opts: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' }): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', opts);
}

// 'HH:mm' → '2:30 PM'.
export function timeLabel(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  return new Date(2000, 0, 1, h, m).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export function dateKey(date: Date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function addDays(key: string, days: number): string {
  const [y, m, d] = key.split('-').map(Number);
  return dateKey(new Date(y, m - 1, d + days));
}

export function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const minutes = Math.round((Date.now() - then) / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export function cx(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}
