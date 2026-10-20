import 'server-only';
import { cookies } from 'next/headers';
import type { NextResponse } from 'next/server';
import { API_V1, SECURE_COOKIES } from './config';

// The session lives in two httpOnly cookies the page's JavaScript can't read:
//   tr_at — the API access token (expires a little before the token does, so
//           "missing" means "refresh it");
//   tr_rt — the refresh token, sent only to this app's server.
// Route handlers and proxy.ts refresh and rewrite them; Server Components only
// read them (they can't set cookies).
import { ACCESS_COOKIE, REFRESH_COOKIE } from './session-names';
export { ACCESS_COOKIE, REFRESH_COOKIE };
const ACCESS_MAX_AGE = 25 * 60; // the API's access tokens last 30 minutes
const REFRESH_MAX_AGE = 7 * 24 * 60 * 60;

export type Tokens = { access_token: string; refresh_token: string };

const base = { httpOnly: true, secure: SECURE_COOKIES, sameSite: 'lax' as const, path: '/' };

type CookieWriter = { set: (name: string, value: string, options: Record<string, unknown>) => unknown };

export function writeSession(target: CookieWriter, tokens: Tokens): void {
  target.set(ACCESS_COOKIE, tokens.access_token, { ...base, maxAge: ACCESS_MAX_AGE });
  target.set(REFRESH_COOKIE, tokens.refresh_token, { ...base, maxAge: REFRESH_MAX_AGE });
}

export function clearSession(target: CookieWriter): void {
  target.set(ACCESS_COOKIE, '', { ...base, maxAge: 0 });
  target.set(REFRESH_COOKIE, '', { ...base, maxAge: 0 });
}

export function setSessionOn(response: NextResponse, tokens: Tokens): void {
  writeSession(response.cookies, tokens);
}

// Swap a refresh token for a new pair. null = the session is over.
export async function refreshTokens(refreshToken: string): Promise<Tokens | null> {
  try {
    const res = await fetch(`${API_V1}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.access_token && data?.refresh_token ? data : null;
  } catch {
    return null;
  }
}

// For Server Components: the current access token, if any.
export async function getAccessToken(): Promise<string | null> {
  return (await cookies()).get(ACCESS_COOKIE)?.value ?? null;
}
