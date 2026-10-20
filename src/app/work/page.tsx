import { redirect } from 'next/navigation';
import { getSession } from '@/lib/server/auth';

// /work → their business (owners first), or the "for business" page if none.
export default async function WorkIndex() {
  const session = await getSession();
  if (!session) redirect('/login?next=/work');
  const workplace = session.workplaces.find((w) => w.role === 'owner') ?? session.workplaces[0];
  redirect(workplace ? `/work/${workplace.businessId}/today` : '/for-business');
}
