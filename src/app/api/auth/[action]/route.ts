import { NextResponse, type NextRequest } from 'next/server';
import { API_V1, SITE_URL } from '@/lib/server/config';
import { REFRESH_COOKIE, clearSession, setSessionOn } from '@/lib/server/session';

// Sign-in style calls whose answer includes tokens: the tokens become httpOnly
// cookies here and the page only gets the user back. Bodies are passed through
// as the API expects them (see mobile/reference/api/auth.json).
const AUTH_ACTIONS: Record<string, string> = {
  login: 'auth/login',
  register: 'auth/register',
  'verify-email': 'auth/verify-email',
  'complete-registration': 'auth/complete-registration',
  'google-exchange': 'auth/google/exchange',
  'change-password': 'auth/change-password',
};

export async function POST(request: NextRequest, ctx: RouteContext<'/api/auth/[action]'>) {
  const { action } = await ctx.params;
  const origin = request.headers.get('origin');
  if (origin && origin !== SITE_URL && origin !== request.nextUrl.origin) {
    return NextResponse.json({ error: 'forbidden', message: 'Cross-site request refused' }, { status: 403 });
  }

  if (action === 'logout') {
    const refresh = request.cookies.get(REFRESH_COOKIE)?.value;
    if (refresh) {
      await fetch(`${API_V1}/auth/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refresh }),
      }).catch(() => {});
    }
    const response = NextResponse.json({ ok: true });
    clearSession(response.cookies);
    return response;
  }

  const path = AUTH_ACTIONS[action];
  if (!path) return NextResponse.json({ error: 'not_found', message: 'Unknown action' }, { status: 404 });

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (action === 'change-password') {
    const access = request.cookies.get('tr_at')?.value;
    if (access) headers.Authorization = `Bearer ${access}`;
  }
  const upstream = await fetch(`${API_V1}/${path}`, {
    method: 'POST',
    headers,
    body: await request.text(),
    cache: 'no-store',
  });
  const data = await upstream.json().catch(() => null);
  if (!upstream.ok) return NextResponse.json(data ?? { error: 'unknown_error' }, { status: upstream.status });

  // AuthResponse = { user, tokens }; change-password = { tokens } (all other sessions end).
  const tokens = data?.tokens;
  const response = NextResponse.json({ user: data?.user ?? null }, { status: upstream.status });
  if (tokens?.access_token && tokens?.refresh_token) setSessionOn(response, tokens);
  return response;
}
