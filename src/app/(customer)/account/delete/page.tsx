import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/server/auth';
import { DeleteForm } from '@/components/customer/account/account-forms';
import { SubPage } from '@/components/customer/account/sub-page';

export const metadata: Metadata = { title: 'Delete account' };

export default async function DeletePage() {
  const session = await getSession();
  if (!session) redirect('/login?next=/account/delete');
  return (
    <SubPage title="Delete your account">
      <DeleteForm ownsBusiness={session.workplaces.some((w) => w.role === 'owner')} />
    </SubPage>
  );
}
