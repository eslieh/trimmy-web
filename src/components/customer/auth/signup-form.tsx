'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ApiError, authAction, errorMessage } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/field';
import { AuthHeading, Divider, normalizePhone } from './shared';
import { GoogleButton } from './google-button';

// The mobile app's email signup (email → password → mobile → name), on one
// page: POST /auth/register, then the emailed code on /verify.
export function SignupForm({ next }: { next: string | null }) {
  const router = useRouter();
  const [form, setForm] = useState({ first: '', last: '', email: '', phone: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<React.ReactNode>(null);
  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const nextQuery = next ? `?next=${encodeURIComponent(next)}` : '';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const email = form.email.trim();
    try {
      await authAction('register', {
        email,
        password: form.password,
        first_name: form.first.trim(),
        last_name: form.last.trim(),
        phone: normalizePhone(form.phone) || undefined,
      });
      const q = new URLSearchParams({ email, ...(next ? { next } : {}) });
      router.push(`/verify?${q}`);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'email_taken') {
        setError(
          <>
            An account with this email already exists.{' '}
            <Link href={`/login${nextQuery}`} className="font-semibold underline">Log in instead</Link>
          </>,
        );
      } else {
        setError(errorMessage(err, "Couldn't create your account. Please try again."));
      }
      setBusy(false);
    }
  };

  const valid = form.first.trim() && form.last.trim() && form.email.trim() && form.phone.trim().length >= 9 && form.password.length >= 8;

  return (
    <>
      <AuthHeading title="Create your account" subtitle="Book salons and barbers, pay deposits with M-Pesa, and keep track of every visit." />
      <GoogleButton next={next} label="Sign up with Google" />
      <Divider label="or with email" />
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="First name" autoComplete="given-name" required maxLength={100} value={form.first} onChange={set('first')} />
          <Input label="Last name" autoComplete="family-name" required maxLength={100} value={form.last} onChange={set('last')} />
        </div>
        <Input label="Email" type="email" autoComplete="email" required value={form.email} onChange={set('email')} />
        <Input
          label="Mobile number"
          type="tel"
          autoComplete="tel"
          required
          placeholder="0712 345 678"
          hint="For booking updates and reminders."
          value={form.phone}
          onChange={set('phone')}
        />
        <Input
          label="Password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          maxLength={128}
          hint="At least 8 characters."
          value={form.password}
          onChange={set('password')}
        />
        {error ? <p role="alert" className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p> : null}
        <Button type="submit" size="lg" loading={busy} disabled={!valid}>
          Continue
        </Button>
        <p className="text-center text-xs text-ink-2">
          By continuing you agree to Trimmy&apos;s{' '}
          <Link href="/legal/terms" className="underline">Terms</Link> and{' '}
          <Link href="/legal/privacy" className="underline">Privacy policy</Link>.
        </p>
      </form>
      <p className="mt-6 text-center text-sm text-ink-2">
        Already have an account?{' '}
        <Link href={`/login${nextQuery}`} className="font-semibold text-ink hover:underline">
          Log in
        </Link>
      </p>
    </>
  );
}
