import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/server/auth';
import { LoginForm } from '@/components/customer/auth/login-form';
import { firstParam, safeNext } from '@/components/customer/labels';

export const metadata: Metadata = { title: 'Log in' };

export default async function LoginPage({ searchParams }: PageProps<'/login'>) {
  const params = await searchParams;
  const next = safeNext(params.next);
  // Already signed in (and verified): nothing to do here.
  if ((await getSession())?.user.verified) redirect(next ?? '/');
  const notice = firstParam(params.reset) ? 'Password updated. Log in with your new password.' : null;
  return <LoginForm next={next} notice={notice} />;
}
