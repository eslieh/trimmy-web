import { NextResponse, type NextRequest } from 'next/server';
import { API_V1, SITE_URL } from '@/lib/server/config';
import { ACCESS_COOKIE, REFRESH_COOKIE, clearSession, refreshTokens, setSessionOn } from '@/lib/server/session';

// The browser's only way to the API (same origin, so no CORS): adds the
// session's access token, refreshes it once on a 401, and passes everything
// else through untouched, including multipart uploads and the live event
// stream (GET me/events, streamed as it arrives).
//
// Endpoints that hand out tokens are refused here; they go through
// /api/auth/* so the tokens become httpOnly cookies and never reach the page.
const TOKEN_ENDPOINTS = new Set([
  'auth/login', 'auth/register', 'auth/refresh', 'auth/verify-email', 'auth/complete-registration',
  'auth/complete-phone-registration', 'auth/google/exchange', 'auth/change-password', 'auth/logout',
]);

const HOP_BY_HOP = new Set(['connection', 'keep-alive', 'transfer-encoding', 'content-encoding', 'content-length', 'host']);


async function forward(request: NextRequest, ctx: RouteContext<'/api/proxy/[...path]'>) {
  const { path } = await ctx.params;
  const target = path.join('/');
  if (TOKEN_ENDPOINTS.has(target)) {
    return NextResponse.json({ error: 'not_found', message: 'Use /api/auth for this' }, { status: 404 });
  }
  // Writes only from this site's own pages (cookies are SameSite=Lax; this closes the rest).
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    const origin = request.headers.get('origin');
    if (origin && origin !== SITE_URL && origin !== request.nextUrl.origin) {
      return NextResponse.json({ error: 'forbidden', message: 'Cross-site request refused' }, { status: 403 });
    }
  }

  const url = `${API_V1}/${target}${request.nextUrl.search}`;
  const body = request.method === 'GET' || request.method === 'HEAD' ? undefined : await request.arrayBuffer();
  const send = (token: string | undefined) => {
    const headers = new Headers();
    for (const name of ['content-type', 'accept', 'last-event-id']) {
      const value = request.headers.get(name);
      if (value) headers.set(name, value);
    }
    if (token) headers.set('authorization', `Bearer ${token}`);
    return fetch(url, { method: request.method, headers, body, cache: 'no-store', signal: request.signal });
  };

  let access = request.cookies.get(ACCESS_COOKIE)?.value;
  const refresh = request.cookies.get(REFRESH_COOKIE)?.value;
  let refreshed: { access_token: string; refresh_token: string } | null = null;
  if (!access && refresh) {
    refreshed = await refreshTokens(refresh);
    access = refreshed?.access_token;
  }
  let upstream = await send(access);
  if (upstream.status === 401 && refresh && !refreshed) {
    refreshed = await refreshTokens(refresh);
    if (refreshed) upstream = await send(refreshed.access_token);
  }

  const headers = new Headers();
  upstream.headers.forEach((value, name) => {
    if (!HOP_BY_HOP.has(name.toLowerCase())) headers.set(name, value);
  });
  const response = new NextResponse(upstream.body, { status: upstream.status, headers });
  if (refreshed) setSessionOn(response, refreshed);
  else if (upstream.status === 401 && refresh) clearSession(response.cookies);
  return response;
}

export { forward as GET, forward as POST, forward as PUT, forward as PATCH, forward as DELETE };
