import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/server/auth';
import { CreateBusinessForm } from '@/components/setup/create-business';
import { SetupShell } from '@/components/setup/wizard';

export const metadata: Metadata = { title: 'Set up your business' };

// Start setting up a business: resume an unfinished one, or begin with the basics.
export default async function SetupStart() {
  const session = await getSession();
  if (!session) redirect('/signup?next=/setup');
  const draft = session.workplaces.find((w) => w.role === 'owner' && w.status !== 'published');
  if (draft) redirect(`/setup/${draft.businessId}`);
  return (
    <SetupShell step="basics">
      <CreateBusinessForm />
    </SetupShell>
  );
}
