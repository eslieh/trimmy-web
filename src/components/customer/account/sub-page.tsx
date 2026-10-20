import Link from 'next/link';
import { PageHeader } from '@/components/ui/misc';
import { ChevronLeftIcon } from '../icons';

// The frame for each account sub-page: back to Account, a title, a card.
export function SubPage({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-xl">
      <Link href="/account" className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-ink-2 hover:text-ink">
        <ChevronLeftIcon className="size-4" /> Account
      </Link>
      <PageHeader title={title} subtitle={subtitle} />
      <div className="rounded-card border border-line p-6">{children}</div>
    </div>
  );
}
