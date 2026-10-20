'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ApiError, api, errorMessage } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/field';
import { Tabs } from '@/components/ui/misc';
import { AuthHeading, FormError, FormNotice, codeInputProps, normalizePhone } from './shared';

type Channel = 'email' | 'phone';
type Step = 'contact' | 'code' | 'password';

// Account recovery by email or SMS: forgot-password → verify-reset-otp →
// reset-password, each taking { email } or { phone } (server auth/schemas.py).
export function ForgotPassword() {
  const router = useRouter();
  const [channel, setChannel] = useState<Channel>('email');
  const [step, setStep] = useState<Step>('contact');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const contact = channel === 'email' ? { email: email.trim() } : { phone: normalizePhone(phone) };
  const shown = channel === 'email' ? email.trim() : phone.trim();

  const run = async (fn: () => Promise<void>, fallback: string) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (err) {
      const wait = err instanceof ApiError ? Number(err.body?.retry_after_seconds) : NaN;
      setError(Number.isFinite(wait) && wait > 0 ? `Please wait ${wait}s before asking for another code.` : errorMessage(err, fallback));
    } finally {
      setBusy(false);
    }
  };

  const sendCode = (e?: React.FormEvent) => {
    e?.preventDefault();
    return run(async () => {
      await api('/auth/forgot-password', { method: 'POST', body: contact });
      setNotice(null);
      setCode('');
      setStep('code');
    }, "Couldn't send a code. Please try again.");
  };

  const resend = () =>
    run(async () => {
      const res =
        channel === 'phone'
          ? await api<{ message: string }>('/auth/forgot-password', { method: 'POST', body: contact })
          : await api<{ message: string }>('/auth/resend-otp', { method: 'POST', body: { email: email.trim(), purpose: 'password_reset' } });
      setNotice(res.message);
    }, "Couldn't resend the code.");

  const checkCode = (e: React.FormEvent) => {
    e.preventDefault();
    return run(async () => {
      await api('/auth/verify-reset-otp', { method: 'POST', body: { ...contact, otp: code } });
      setNotice(null);
      setStep('password');
    }, 'Invalid or expired code.');
  };

  const reset = (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      setError("The passwords don't match.");
      return;
    }
    return run(async () => {
      await api('/auth/reset-password', { method: 'POST', body: { ...contact, otp: code, new_password: password } });
      router.replace(`/login?reset=1`);
    }, "Couldn't update your password.");
  };

  if (step === 'code') {
    return (
      <>
        <AuthHeading
          title="Enter your code"
          subtitle={
            <>
              If an account exists for <strong className="text-ink">{shown}</strong>, we&apos;ve sent it a 6-digit code.
            </>
          }
        />
        <form onSubmit={checkCode} className="flex flex-col gap-4">
          <Input label="Reset code" autoFocus {...codeInputProps(code, setCode)} />
          <FormError message={error} />
          {notice ? <FormNotice>{notice}</FormNotice> : null}
          <Button type="submit" size="lg" loading={busy} disabled={code.length !== 6}>
            Continue
          </Button>
        </form>
        <div className="mt-5 flex flex-wrap justify-between gap-2 text-sm">
          <button type="button" onClick={() => setStep('contact')} className="font-semibold text-ink-2 hover:text-ink">
            Use a different {channel === 'email' ? 'email' : 'number'}
          </button>
          <button type="button" onClick={resend} disabled={busy} className="font-semibold text-brand hover:underline disabled:opacity-50">
            Send a new code
          </button>
        </div>
      </>
    );
  }

  if (step === 'password') {
    return (
      <>
        <AuthHeading title="Choose a new password" subtitle="You'll be signed out everywhere else." />
        <form onSubmit={reset} className="flex flex-col gap-4">
          <Input
            label="New password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            maxLength={128}
            required
            hint="At least 8 characters."
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Input
            label="Confirm new password"
            type="password"
            autoComplete="new-password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
          <FormError message={error} />
          <Button type="submit" size="lg" loading={busy} disabled={password.length < 8 || !confirm}>
            Update password
          </Button>
        </form>
      </>
    );
  }

  return (
    <>
      <AuthHeading title="Forgot your password?" subtitle="We'll send you a code to reset it." />
      <div className="mb-5">
        <Tabs<Channel>
          value={channel}
          onChange={(c) => {
            setChannel(c);
            setError(null);
          }}
          options={[
            { key: 'email', label: 'Email' },
            { key: 'phone', label: 'Phone (SMS)' },
          ]}
        />
      </div>
      <form onSubmit={sendCode} className="flex flex-col gap-4">
        {channel === 'email' ? (
          <Input label="Email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        ) : (
          <Input
            label="Mobile number"
            type="tel"
            autoComplete="tel"
            required
            placeholder="0712 345 678"
            hint="The verified number on your account."
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        )}
        <FormError message={error} />
        <Button type="submit" size="lg" loading={busy} disabled={channel === 'email' ? !email.trim() : phone.trim().length < 9}>
          Send code
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-ink-2">
        Remembered it?{' '}
        <Link href="/login" className="font-semibold text-ink hover:underline">Log in</Link>
      </p>
    </>
  );
}
