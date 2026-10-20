import 'server-only';
import { API_V1 } from './config';
import { getAccessToken } from './session';

export class ServerApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

// Server Components calling the API: with the visitor's session when there is
// one (proxy.ts has refreshed it before the page renders), or anonymously for
// public pages. `revalidate` caches public reads (e.g. Explore) for that many
// seconds; signed-in reads are never cached.
export async function serverApi<T>(
  path: string,
  options: { method?: string; body?: unknown; auth?: boolean; revalidate?: number } = {},
): Promise<T> {
  const token = options.auth === false ? null : await getAccessToken();
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API_V1}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    ...(token || options.revalidate === undefined ? { cache: 'no-store' as const } : { next: { revalidate: options.revalidate } }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ServerApiError(res.status, data?.error ?? 'unknown_error', data?.message ?? 'Request failed');
  }
  return data as T;
}
