'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ApiError, api, authAction, errorMessage } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/field';
import { AuthHeading, FormError, FormNotice, codeInputProps, useAfterSignIn } from './shared';

// The emailed 6-digit code, after signing up or logging in unverified
// (the server re-sends a code in that case). POST /auth/verify-email signs in.
export function VerifyForm({ email, next, from }: { email: string | null; next: string | null; from: string | null }) {
  const afterSignIn = useAfterSignIn();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [resending, setResending] = useState(false);

  if (!email) {
    return (
      <>
        <AuthHeading title="Verify your email" subtitle="This link is missing the email address to verify." />
        <Link href="/signup" className="font-semibold text-brand hover:underline">Back to sign up</Link>
      </>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await authAction('verify-email', { email, otp: code });
      // Just signed up with nowhere to go back to: start exploring.
      await afterSignIn(next ?? (from === 'login' ? null : '/'));
    } catch (err) {
      setError(errorMessage(err, 'Invalid or expired code. Please try again.'));
      setBusy(false);
    }
  };

  const resend = async () => {
    setResending(true);
    setNotice(null);
    setError(null);
    try {
      const res = await api<{ message: string }>('/auth/resend-otp', { method: 'POST', body: { email, purpose: 'verification' } });
      setNotice(res.message);
    } catch (err) {
      const wait = err instanceof ApiError ? Number(err.body?.retry_after_seconds) : NaN;
      setError(Number.isFinite(wait) && wait > 0 ? `Please wait ${wait}s before asking for another code.` : errorMessage(err, "Couldn't resend the code."));
    } finally {
      setResending(false);
    }
  };

  return (
    <>
      <AuthHeading
        title="Verify your email"
        subtitle={
          <>
            Enter the 6-digit code we sent to <strong className="text-ink">{email}</strong>.
          </>
        }
      />
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Input label="Verification code" autoFocus {...codeInputProps(code, setCode)} />
        <FormError message={error} />
        {notice ? <FormNotice>{notice}</FormNotice> : null}
        <Button type="submit" size="lg" loading={busy} disabled={code.length !== 6}>
          Verify and continue
        </Button>
      </form>
      <p className="mt-5 text-center text-sm text-ink-2">
        Didn&apos;t get a code? Check spam, or{' '}
        <button type="button" onClick={resend} disabled={resending} className="font-semibold text-brand hover:underline disabled:opacity-50">
          {resending ? 'sending…' : 'send a new one'}
        </button>
        .
      </p>
    </>
  );
}
