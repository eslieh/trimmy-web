import { redirect } from 'next/navigation';
import { getSession } from '@/lib/server/auth';

// /work → their business (owners first), or business setup if none.
export default async function WorkIndex() {
  const session = await getSession();
  if (!session) redirect('/login?next=/work');
  const workplace =
    session.workplaces.find((w) => w.role === 'owner' && w.status === 'published') ??
    session.workplaces.find((w) => w.role === 'front_desk') ??
    session.workplaces.find((w) => w.role === 'owner'); // a draft: work redirects it to setup
  redirect(workplace ? `/work/${workplace.businessId}/today` : '/setup');
}
