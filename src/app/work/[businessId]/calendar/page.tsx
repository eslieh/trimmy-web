import type { Metadata } from 'next';
import { CalendarView } from '@/components/work-daily/calendar-view';

export const metadata: Metadata = { title: 'Calendar' };

export default async function CalendarPage({ searchParams }: PageProps<'/work/[businessId]/calendar'>) {
  const { date } = await searchParams;
  const d = Array.isArray(date) ? date[0] : date;
  return <CalendarView initialDate={d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : undefined} />;
}
