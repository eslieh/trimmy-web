'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useSession } from '@/components/session';
import type { MyBusiness } from '@/types/api';

// After any sign-in (password, Google, a verified signup): go where they were
// headed, else to their business if they run or front one, else Explore.
export function useAfterSignIn() {
  const router = useRouter();
  const { refresh } = useSession();
  return useCallback(
    async (next: string | null) => {
      let dest = next;
      if (!dest) {
        const businesses = await api<{ businesses: MyBusiness[] }>('/me/businesses')
          .then((r) => r.businesses)
          .catch(() => [] as MyBusiness[]);
        dest = businesses.some((b) => b.role === 'owner' || b.role === 'front_desk') ? '/work' : '/';
      }
      router.replace(dest);
      refresh();
    },
    [router, refresh],
  );
}

export function AuthHeading({ title, subtitle }: { title: string; subtitle?: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
      {subtitle ? <p className="mt-1.5 text-ink-2">{subtitle}</p> : null}
    </div>
  );
}

export function FormError({ message }: { message: string | null | undefined }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">
      {message}
    </p>
  );
}

export function FormNotice({ children }: { children: React.ReactNode }) {
  return <p role="status" className="rounded-xl bg-success/10 px-4 py-3 text-sm text-success">{children}</p>;
}

export function Divider({ label }: { label: string }) {
  return (
    <div className="my-5 flex items-center gap-3 text-xs font-semibold uppercase tracking-wide text-ink-3">
      <span className="h-px flex-1 bg-line" />
      {label}
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}

// A 6-digit code field: numeric keyboard, one-time-code autofill.
export function codeInputProps(value: string, onChange: (v: string) => void) {
  return {
    value,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value.replace(/\D/g, '').slice(0, 6)),
    inputMode: 'numeric' as const,
    autoComplete: 'one-time-code',
    pattern: '[0-9]{6}',
    maxLength: 6,
    placeholder: '123456',
    className: '[&_input]:text-center [&_input]:text-2xl [&_input]:tracking-[0.5em] [&_input]:font-bold',
  };
}

// Kenyan numbers typed locally (0712…, 712…) → +254712…; anything already
// international is kept. The server validates and normalises too.
export function normalizePhone(raw: string): string {
  const trimmed = raw.replace(/[\s()-]/g, '');
  if (!trimmed) return '';
  if (trimmed.startsWith('+')) return trimmed;
  if (trimmed.startsWith('254')) return `+${trimmed}`;
  if (/^0[17]\d{8}$/.test(trimmed)) return `+254${trimmed.slice(1)}`;
  if (/^[17]\d{8}$/.test(trimmed)) return `+254${trimmed}`;
  return trimmed;
}
