import type { Metadata } from 'next';
import { GoogleCallback } from '@/components/customer/auth/google-callback';
import { firstParam } from '@/components/customer/labels';

export const metadata: Metadata = { title: 'Signing in', robots: { index: false } };

// Where the API sends the browser back after Google: ?code=… or ?error=….
export default async function GoogleCallbackPage({ searchParams }: PageProps<'/auth/google'>) {
  const params = await searchParams;
  return <GoogleCallback code={firstParam(params.code) ?? null} error={firstParam(params.error) ?? null} />;
}
