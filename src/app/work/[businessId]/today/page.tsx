import type { Metadata } from 'next';
import { TodayView } from '@/components/work-daily/today-view';

export const metadata: Metadata = { title: 'Today' };

function one(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

// ?date=YYYY-MM-DD opens another day; ?view=grid|list picks the layout.
export default async function TodayPage({ searchParams }: PageProps<'/work/[businessId]/today'>) {
  const sp = await searchParams;
  const date = one(sp.date);
  const view = one(sp.view);
  return (
    <TodayView
      initialDate={date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : undefined}
      initialView={view === 'grid' || view === 'list' ? view : undefined}
    />
  );
}
