import { notFound, redirect } from 'next/navigation';
import { getSession } from '@/lib/server/auth';
import { WorkProvider } from '@/components/work/context';

// Setup for a business they own. The settings forms reused as steps read the
// business from the work context, so the wizard provides it as the owner.
export default async function SetupLayout({ children, params }: LayoutProps<'/setup/[businessId]'>) {
  const { businessId } = await params;
  const session = await getSession();
  if (!session) redirect(`/login?next=/setup/${businessId}`);
  const owned = session.workplaces.find((w) => w.businessId === businessId && w.role === 'owner');
  if (!owned) notFound();
  return (
    <WorkProvider value={{ businessId, businessName: owned.name, role: 'owner', staffId: owned.staffId }}>
      {children}
    </WorkProvider>
  );
}
