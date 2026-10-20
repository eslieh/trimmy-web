import type { Metadata } from 'next';
import { DaySummaryView } from '@/components/work-daily/day-summary-view';

export const metadata: Metadata = { title: 'Day summary' };

// ?date= opens a past day (e.g. from the owner's "day submitted" notification).
export default async function DaySummaryPage({ searchParams }: PageProps<'/work/[businessId]/day-summary'>) {
  const { date } = await searchParams;
  const d = Array.isArray(date) ? date[0] : date;
  return <DaySummaryView initialDate={d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : undefined} />;
}
