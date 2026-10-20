import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/server/auth';
import { SignupForm } from '@/components/customer/auth/signup-form';
import { safeNext } from '@/components/customer/labels';

export const metadata: Metadata = { title: 'Sign up' };

export default async function SignupPage({ searchParams }: PageProps<'/signup'>) {
  const next = safeNext((await searchParams).next);
  // Already signed in (and verified): nothing to do here.
  if ((await getSession())?.user.verified) redirect(next ?? '/');
  return <SignupForm next={next} />;
}
