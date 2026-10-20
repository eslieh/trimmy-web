// Calling the Trimmy API from the browser. Everything goes through this
// app's /api/proxy (the session is in httpOnly cookies there), so pages never
// handle tokens. Paths are the API's, without /api/v1, e.g. api('/me/bookings').
// Error bodies are { error, message } (FastAPI's own are { detail }).

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public body: Record<string, unknown> | null = null,
  ) {
    super(message);
  }
}

type Options = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown; // JSON, or FormData for uploads
  signal?: AbortSignal;
};

export async function api<T>(path: string, options: Options = {}): Promise<T> {
  const isForm = typeof FormData !== 'undefined' && options.body instanceof FormData;
  const res = await fetch(`/api/proxy${path.startsWith('/') ? path : `/${path}`}`, {
    method: options.method ?? 'GET',
    headers: isForm || options.body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: isForm ? (options.body as FormData) : options.body !== undefined ? JSON.stringify(options.body) : undefined,
    signal: options.signal,
    credentials: 'same-origin',
  });
  return parse<T>(res);
}

// Sign-in style calls (/api/auth/login, register, verify-email, google-exchange,
// change-password, logout): the session cookies are set by the server.
export async function authAction<T = { user: import('@/types/api').User | null }>(
  action: string,
  body?: unknown,
): Promise<T> {
  const res = await fetch(`/api/auth/${action}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    credentials: 'same-origin',
  });
  return parse<T>(res);
}

async function parse<T>(res: Response): Promise<T> {
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const detail = Array.isArray(data?.detail) ? data.detail[0]?.msg : data?.detail;
    throw new ApiError(
      res.status,
      data?.error ?? (Array.isArray(data?.detail) ? 'validation_error' : 'unknown_error'),
      data?.message ?? (typeof detail === 'string' ? detail : 'Something went wrong. Please try again.'),
      data && typeof data === 'object' ? data : null,
    );
  }
  return data as T;
}

export function errorMessage(err: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (err instanceof ApiError) return err.message || fallback;
  return fallback;
}

export function toQuery(pairs: Record<string, string | number | boolean | null | undefined | (string | number)[]>): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(pairs)) {
    if (value === null || value === undefined || value === '') continue;
    for (const v of Array.isArray(value) ? value : [value]) {
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`);
    }
  }
  return parts.length ? `?${parts.join('&')}` : '';
}
