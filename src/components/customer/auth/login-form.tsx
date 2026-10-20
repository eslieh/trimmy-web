'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ApiError, authAction, errorMessage } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/field';
import { AuthHeading, Divider, FormError, FormNotice, useAfterSignIn } from './shared';
import { GoogleButton } from './google-button';

export function LoginForm({ next, notice }: { next: string | null; notice?: string | null }) {
  const router = useRouter();
  const afterSignIn = useAfterSignIn();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nextQuery = next ? `?next=${encodeURIComponent(next)}` : '';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await authAction('login', { email: email.trim(), password });
      await afterSignIn(next);
    } catch (err) {
      // 403 not_verified: the server has already emailed a fresh code.
      if (err instanceof ApiError && err.code === 'not_verified') {
        const q = new URLSearchParams({ email: email.trim(), from: 'login', ...(next ? { next } : {}) });
        router.push(`/verify?${q}`);
        return;
      }
      setError(errorMessage(err, "Couldn't log you in. Please try again."));
      setBusy(false);
    }
  };

  return (
    <>
      <AuthHeading title="Log in" subtitle="Welcome back. Book your next appointment in seconds." />
      {notice ? <div className="mb-4"><FormNotice>{notice}</FormNotice></div> : null}
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate={false}>
        <Input label="Email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <Input
          label="Password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <div className="-mt-1 text-right">
          <Link href="/forgot-password" className="text-sm font-semibold text-brand hover:underline">
            Forgot password?
          </Link>
        </div>
        <FormError message={error} />
        <Button type="submit" size="lg" loading={busy} disabled={!email || !password}>
          Log in
        </Button>
      </form>
      <Divider label="or" />
      <GoogleButton next={next} />
      <p className="mt-6 text-center text-sm text-ink-2">
        New to Trimmy?{' '}
        <Link href={`/signup${nextQuery}`} className="font-semibold text-ink hover:underline">
          Create an account
        </Link>
      </p>
    </>
  );
}
