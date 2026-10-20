import 'server-only';

// Server-side only: the browser never talks to the API directly (it goes
// through /api/proxy, which holds the session), so the API's address and
// the tokens stay off the client.
export const API_URL = (process.env.TRIMMY_API_URL ?? 'https://trimmy-staging.pesagrid.co.ke').replace(/\/$/, '');
export const API_V1 = `${API_URL}/api/v1`;
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
export const SECURE_COOKIES = SITE_URL.startsWith('https://');
