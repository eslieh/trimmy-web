import type { WeeklyHours } from '@/types/business';

// Wall-clock helpers. Bookings carry the business's local 'YYYY-MM-DD' and
// 'HH:mm'; these never go through UTC. "Now" is read in the business's
// timezone, so a laptop set to another zone still sees the salon's day.

export const DEFAULT_TIMEZONE = 'Africa/Nairobi';

const WEEKDAYS: (keyof WeeklyHours)[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

export function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + (m || 0);
}

export function toTime(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

export function weekdayOf(key: string): keyof WeeklyHours {
  const [y, m, d] = key.split('-').map(Number);
  return WEEKDAYS[new Date(y, m - 1, d).getDay()];
}

// The business's current date and minute of the day.
export function businessNow(timezone = DEFAULT_TIMEZONE): { date: string; minutes: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00';
  return { date: `${get('year')}-${get('month')}-${get('day')}`, minutes: Number(get('hour')) * 60 + Number(get('minute')) };
}

export function isDateKey(value: string | undefined | null): value is string {
  return !!value && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function isTime(value: string | undefined | null): value is string {
  return !!value && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export function monthStart(key: string): string {
  return `${key.slice(0, 7)}-01`;
}

export function monthEnd(key: string): string {
  const [y, m] = key.split('-').map(Number);
  return `${key.slice(0, 7)}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`;
}

export function addMonths(key: string, months: number): string {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, m - 1 + months, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

// Inclusive day count between two date keys.
export function daysBetween(from: string, to: string): number {
  const [a, b] = [from, to].map((k) => {
    const [y, m, d] = k.split('-').map(Number);
    return Date.UTC(y, m - 1, d); // only to count days, never shown
  });
  return Math.round((b - a) / 86_400_000) + 1;
}

export function hourLabel(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  return `${h % 12 === 0 ? 12 : h % 12} ${h >= 12 ? 'PM' : 'AM'}`;
}

export function durationLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

// An ISO instant (e.g. lastBookingAt) as the business's calendar date: '21 Oct 2026'.
export function instantDate(iso: string, timezone = DEFAULT_TIMEZONE): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: timezone });
}
