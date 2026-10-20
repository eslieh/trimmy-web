'use client';

import { useState } from 'react';
import { ApiError, api, errorMessage, toQuery } from '@/lib/api';
import { buttonClass, Spinner } from '@/components/ui/button';

// Google sign-in, step 1 (server app/modules/auth/google.py): get the Google
// URL (redirect_uri = this site's /auth/google) and go there. Google comes
// back to /auth/google?code=… (GoogleCallback), with ?next= kept in sessionStorage.
// A PKCE verifier kept in this tab's sessionStorage means only this browser
// can redeem the one-time code.
export const GOOGLE_VERIFIER_KEY = 'trimmy.google.verifier';
export const GOOGLE_NEXT_KEY = 'trimmy.google.next';

function base64url(bytes: Uint8Array): string {
  let s = '';
  bytes.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function pkce(): Promise<{ verifier: string; challenge: string } | null> {
  if (typeof crypto === 'undefined' || !crypto.subtle) return null; // not a secure context
  const verifier = base64url(crypto.getRandomValues(new Uint8Array(32)));
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return { verifier, challenge: base64url(new Uint8Array(digest)) };
}

export function GoogleButton({ next, label = 'Continue with Google' }: { next: string | null; label?: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = async () => {
    setBusy(true);
    setError(null);
    try {
      const keys = await pkce();
      try {
        if (keys) sessionStorage.setItem(GOOGLE_VERIFIER_KEY, keys.verifier);
        else sessionStorage.removeItem(GOOGLE_VERIFIER_KEY);
        if (next) sessionStorage.setItem(GOOGLE_NEXT_KEY, next);
        else sessionStorage.removeItem(GOOGLE_NEXT_KEY);
      } catch {
        // No sessionStorage: carry on without PKCE (the server makes it optional).
      }
      // Google comes back to this site's own callback page (the server only
      // accepts URLs on its allowlist).
      const { url } = await api<{ url: string }>(
        `/auth/google/url${toQuery({ platform: 'web', redirect_uri: `${window.location.origin}/auth/google`, code_challenge: keys?.challenge })}`,
      );
      window.location.assign(url);
    } catch (err) {
      setError(
        err instanceof ApiError && err.code === 'invalid_redirect'
          ? "Google sign-in isn't available on this address yet. Please use email and password."
          : errorMessage(err, "Couldn't start Google sign-in. Please try again."),
      );
      setBusy(false);
    }
  };

  return (
    <div>
      <button type="button" onClick={start} disabled={busy} className={buttonClass('secondary', 'md', 'w-full')}>
        {busy ? (
          <Spinner className="size-4" />
        ) : (
          <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
            <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.2-2.1 3.5-5.1 3.5-8.8z" />
            <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0 0 12 24z" />
            <path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6h-4a12 12 0 0 0 0 10.8l4-3.1z" />
            <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1c.9-2.9 3.6-4.9 6.7-4.9z" />
          </svg>
        )}
        {label}
      </button>
      {error ? <p role="alert" className="mt-2 text-sm text-danger">{error}</p> : null}
    </div>
  );
}
