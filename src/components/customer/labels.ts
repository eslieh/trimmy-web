import type { BookingStatus } from '@/types/booking';
import type { BusinessCategory, DayHours, WeeklyHours } from '@/types/business';

// Words and small rules shared by the customer pages (same wording as the
// mobile app's data/ and utils/ files).

export const CATEGORIES: { value: BusinessCategory; label: string }[] = [
  { value: 'hair_salon', label: 'Hair salon' },
  { value: 'barbershop', label: 'Barbershop' },
  { value: 'nail_salon', label: 'Nail salon' },
  { value: 'spa', label: 'Spa' },
  { value: 'beauty', label: 'Beauty' },
  { value: 'other', label: 'Other' },
];

export function categoryLabel(value: string): string {
  return CATEGORIES.find((c) => c.value === value)?.label ?? value.replace(/_/g, ' ');
}

export const STATUS_LABEL: Record<BookingStatus, string> = {
  pending_payment: 'Awaiting deposit',
  confirmed: 'Confirmed',
  in_progress: 'In progress',
  completed: 'Completed',
  no_show: 'No-show',
  cancelled: 'Cancelled',
};

export const STATUS_TONE: Record<BookingStatus, 'neutral' | 'success' | 'warning' | 'danger' | 'brand'> = {
  pending_payment: 'warning',
  confirmed: 'success',
  in_progress: 'brand',
  completed: 'neutral',
  no_show: 'danger',
  cancelled: 'danger',
};

// depositPayment.failureReason → customer-facing text (mobile utils/depositPayment.ts).
const FAILURE_MESSAGES: Record<string, string> = {
  cancelled: 'You dismissed the M-Pesa prompt.',
  insufficient_funds: "Your M-Pesa balance wasn't enough for the deposit.",
  wrong_pin: 'The M-Pesa PIN entered was incorrect.',
  timeout: 'The M-Pesa prompt timed out before a PIN was entered.',
  busy: 'Another M-Pesa transaction was in progress. Wait a moment and try again.',
  provider_error: "M-Pesa couldn't complete the payment.",
  failed: "The payment didn't go through.",
};

export function depositFailureMessage(reason: string | null | undefined): string {
  return (reason && FAILURE_MESSAGES[reason]) || FAILURE_MESSAGES.failed;
}

export const DAYS: (keyof WeeklyHours)[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

export function dayName(day: keyof WeeklyHours): string {
  return day[0].toUpperCase() + day.slice(1);
}

export function hoursLabel(hours: DayHours): string {
  if (!hours) return 'Closed';
  return `${fmtTime(hours.open)} – ${fmtTime(hours.close)}`;
}

function fmtTime(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  const suffix = h >= 12 && h < 24 ? 'PM' : 'AM';
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, '0')} ${suffix}`;
}

// Open right now in the business's timezone (profiles don't carry one yet;
// every business is in Kenya, so Nairobi is the default the server uses too).
export function openNow(hours: WeeklyHours, at: Date, timeZone = 'Africa/Nairobi'): { open: boolean; today: keyof WeeklyHours } {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone, weekday: 'long', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(at);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  const today = get('weekday').toLowerCase() as keyof WeeklyHours;
  const now = `${get('hour')}:${get('minute')}`;
  const h = hours[today];
  return { open: !!h && h.open <= now && now < h.close, today };
}

export function mapsUrl(lat: number, lng: number, address?: string): string {
  const query = lat || lng ? `${lat},${lng}` : (address ?? '');
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

export function minutesLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

// Only same-site paths are honoured as ?next= (no //evil.com or https://…).
export function safeNext(next: string | string[] | undefined | null): string | null {
  const value = Array.isArray(next) ? next[0] : next;
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return null;
  return value;
}

export function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

// Same as session.tsx's displayName, usable in Server Components (functions
// exported from a 'use client' module can't be called on the server).
export function fullName(user: { first_name: string | null; last_name: string | null; email: string | null }): string {
  return [user.first_name, user.last_name].filter(Boolean).join(' ') || user.email || 'You';
}
