import { NextResponse, type NextRequest } from 'next/server';
import { ACCESS_COOKIE, REFRESH_COOKIE } from '@/lib/server/session-names';

// Runs before pages render (not API routes):
// - an expired access cookie with a live refresh cookie gets refreshed here,
//   because Server Components can read cookies but not write them;
// - signed-out visitors to private areas are sent to sign in, then back.
// Optimistic checks only: each area's layout still verifies the role.
const PRIVATE = ['/work', '/bookings', '/account', '/notifications'];

export async function proxy(request: NextRequest) {
  const access = request.cookies.get(ACCESS_COOKIE)?.value;
  const refresh = request.cookies.get(REFRESH_COOKIE)?.value;
  const { pathname, search } = request.nextUrl;

  if (!access && refresh) {
    const { refreshTokens, writeSession } = await import('@/lib/server/session');
    const tokens = await refreshTokens(refresh);
    if (tokens) {
      // Let this render see the new token, and keep it in the browser.
      request.cookies.set(ACCESS_COOKIE, tokens.access_token);
      const response = NextResponse.next({ request });
      writeSession(response.cookies, tokens);
      return response;
    }
  }

  const booking = /^\/b\/[^/]+\/book(\/|$)/.test(pathname); // booking needs an account
  if (!access && (booking || PRIVATE.some((p) => pathname === p || pathname.startsWith(`${p}/`)))) {
    const login = new URL('/login', request.url);
    login.searchParams.set('next', `${pathname}${search}`);
    return NextResponse.redirect(login);
  }
  return NextResponse.next();
}

export const config = {
  // Pages only: not API routes, Next's own files, or static assets.
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico|txt)$).*)'],
};
