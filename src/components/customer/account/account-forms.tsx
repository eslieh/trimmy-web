'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api, authAction, errorMessage } from '@/lib/api';
import { useSession } from '@/components/session';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/field';
import { toast } from '@/components/ui/toast';
import type { User } from '@/types/api';
import { FormError, normalizePhone } from '../auth/shared';

// PATCH /auth/me: names and phone. A changed phone may link bookings a
// business made under that number to this account (server customer_match).
export function DetailsForm({ user }: { user: User }) {
  const router = useRouter();
  const { refresh } = useSession();
  const [first, setFirst] = useState(user.first_name ?? '');
  const [last, setLast] = useState(user.last_name ?? '');
  const [phone, setPhone] = useState(user.phone ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const body: Record<string, string> = { first_name: first.trim(), last_name: last.trim() };
    const nextPhone = normalizePhone(phone);
    if (nextPhone && nextPhone !== user.phone) body.phone = nextPhone;
    try {
      await api<User>('/auth/me', { method: 'PATCH', body });
      toast.success('Details saved');
      refresh();
      router.push('/account');
    } catch (err) {
      setError(errorMessage(err, "Couldn't save your details."));
      setBusy(false);
    }
  };

  return (
    <form onSubmit={save} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input label="First name" autoComplete="given-name" required maxLength={100} value={first} onChange={(e) => setFirst(e.target.value)} />
        <Input label="Last name" autoComplete="family-name" required maxLength={100} value={last} onChange={(e) => setLast(e.target.value)} />
      </div>
      <Input label="Email" type="email" value={user.email ?? ''} disabled hint="Your email can't be changed here. Contact support@trimmy.com if you need to." />
      <Input
        label="Mobile number"
        type="tel"
        autoComplete="tel"
        placeholder="0712 345 678"
        hint="Used for booking updates, M-Pesa prompts and account recovery."
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
      />
      <FormError message={error} />
      <div className="flex gap-3">
        <Button type="submit" loading={busy} disabled={!first.trim() || !last.trim()}>
          Save
        </Button>
        <Link href="/account" className="inline-flex h-11 items-center px-3 font-semibold text-ink-2 hover:text-ink">
          Cancel
        </Link>
      </div>
    </form>
  );
}

// Through /api/auth/change-password: every other session ends and this one
// gets new cookies.
export function PasswordForm() {
  const router = useRouter();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (next !== confirm) {
      setError("The new passwords don't match.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await authAction('change-password', { current_password: current, new_password: next });
      toast.success({ title: 'Password updated', body: "You've been signed out on your other devices." });
      router.push('/account');
    } catch (err) {
      setError(errorMessage(err, "Couldn't change your password."));
      setBusy(false);
    }
  };

  return (
    <form onSubmit={save} className="flex flex-col gap-4">
      <Input label="Current password" type="password" autoComplete="current-password" required value={current} onChange={(e) => setCurrent(e.target.value)} />
      <Input
        label="New password"
        type="password"
        autoComplete="new-password"
        required
        minLength={8}
        maxLength={128}
        hint="At least 8 characters."
        value={next}
        onChange={(e) => setNext(e.target.value)}
      />
      <Input label="Confirm new password" type="password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      <FormError message={error} />
      <p className="text-sm text-ink-2">
        Signed up with Google and never set a password? <Link href="/forgot-password" className="font-semibold underline">Set one with a reset code</Link>.
      </p>
      <div>
        <Button type="submit" loading={busy} disabled={!current || next.length < 8 || !confirm}>
          Update password
        </Button>
      </div>
    </form>
  );
}

// DELETE /auth/me with the password, then sign out here too.
export function DeleteForm({ ownsBusiness }: { ownsBusiness: boolean }) {
  const { signOut } = useSession();
  const [password, setPassword] = useState('');
  const [sure, setSure] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remove = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api('/auth/me', { method: 'DELETE', body: { password } });
      toast('Your account has been deleted');
      await signOut();
    } catch (err) {
      setError(errorMessage(err, "Couldn't delete your account."));
      setBusy(false);
    }
  };

  return (
    <form onSubmit={remove} className="flex flex-col gap-4">
      <ul className="flex list-disc flex-col gap-1.5 rounded-xl bg-danger/5 p-4 pl-9 text-[15px] text-ink">
        <li>Your profile, saved places and sign-in are removed for good.</li>
        <li>Upcoming appointments are not cancelled automatically. Cancel them first if you won&apos;t attend.</li>
        {ownsBusiness ? <li className="font-semibold text-danger">Businesses you own, with their photos, services and team, are deleted too.</li> : null}
        <li>This can&apos;t be undone.</li>
      </ul>
      <Input label="Password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} hint="Signed up with Google? Set a password first with Forgot password." />
      <label className="flex items-start gap-3 text-[15px]">
        <input type="checkbox" checked={sure} onChange={(e) => setSure(e.target.checked)} className="mt-1 size-4 accent-[var(--color-danger)]" />
        I understand my account will be permanently deleted.
      </label>
      <FormError message={error} />
      <div>
        <Button type="submit" variant="danger" loading={busy} disabled={!password || !sure}>
          Delete my account
        </Button>
      </div>
    </form>
  );
}

export function SignOutButton() {
  const { signOut } = useSession();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="secondary"
      loading={busy}
      onClick={() => {
        setBusy(true);
        signOut();
      }}
    >
      Log out
    </Button>
  );
}
