'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { authAction, errorMessage } from '@/lib/api';
import { Spinner } from '@/components/ui/button';
import { safeNext } from '../labels';
import { AuthHeading, useAfterSignIn } from './shared';
import { GOOGLE_NEXT_KEY, GOOGLE_VERIFIER_KEY } from './google-button';

const ERRORS: Record<string, string> = {
  access_denied: 'Google sign-in was cancelled.',
  missing_code: 'Google didn’t send us back a sign-in code.',
};

// Google sign-in, step 4: trade the one-time code (single use, 2 minutes)
// for a session, then carry on where they were headed.
export function GoogleCallback({ code, error }: { code: string | null; error: string | null }) {
  const afterSignIn = useAfterSignIn();
  const started = useRef(false);
  const [failure, setFailure] = useState<string | null>(error ? (ERRORS[error] ?? "Couldn't sign you in with Google.") : code ? null : 'This sign-in link is incomplete.');

  useEffect(() => {
    // Strict Mode runs effects twice in development; the code only works once.
    if (!code || error || started.current) return;
    started.current = true;
    let verifier: string | null = null;
    let next: string | null = null;
    try {
      verifier = sessionStorage.getItem(GOOGLE_VERIFIER_KEY);
      next = safeNext(sessionStorage.getItem(GOOGLE_NEXT_KEY));
      sessionStorage.removeItem(GOOGLE_VERIFIER_KEY);
      sessionStorage.removeItem(GOOGLE_NEXT_KEY);
    } catch {
      // No storage: try without the verifier.
    }
    authAction('google-exchange', verifier ? { code, code_verifier: verifier } : { code })
      .then(() => afterSignIn(next))
      .catch((err) => setFailure(errorMessage(err, "Couldn't sign you in with Google. Please try again.")));
  }, [code, error, afterSignIn]);

  if (failure) {
    return (
      <>
        <AuthHeading title="Sign-in didn't finish" subtitle={failure} />
        <Link href="/login" className="font-semibold text-brand hover:underline">Back to log in</Link>
      </>
    );
  }
  return (
    <div className="flex flex-col items-center gap-4 py-8 text-center">
      <Spinner className="size-8 text-brand" />
      <p className="font-semibold">Signing you in…</p>
    </div>
  );
}
