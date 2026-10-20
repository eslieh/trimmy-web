import type { Metadata } from 'next';
import { VerifyForm } from '@/components/customer/auth/verify-form';
import { firstParam, safeNext } from '@/components/customer/labels';

export const metadata: Metadata = { title: 'Verify your email' };

export default async function VerifyPage({ searchParams }: PageProps<'/verify'>) {
  const params = await searchParams;
  return <VerifyForm email={firstParam(params.email) ?? null} next={safeNext(params.next)} from={firstParam(params.from) ?? null} />;
}
