import { requireOwner } from '@/lib/server/auth';
import { SettingsNav } from '@/components/work-manage/settings/common';

// Settings: a sub-navigation beside (desktop) or above (phones) each section.
export default async function SettingsLayout({ children, params }: LayoutProps<'/work/[businessId]/settings'>) {
  const { businessId } = await params;
  await requireOwner(businessId);
  return (
    <div className="grid gap-6 lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-10">
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <SettingsNav />
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
