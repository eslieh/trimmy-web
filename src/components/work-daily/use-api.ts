'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useLiveEvent } from '@/components/notifications/live';

type State<T> = { path: string | null; key: string | null; data?: T; error?: unknown };

// GET `path` (null = don't load yet) and keep the result. `reload()` fetches
// again but keeps showing what's there meanwhile; a new path starts empty.
// `setData` patches the cached result after a write (e.g. one booking changed).
export function useApi<T>(path: string | null) {
  const [version, setVersion] = useState(0);
  const key = path ? `${path}#${version}` : null;
  const [state, setState] = useState<State<T>>({ path: null, key: null });

  useEffect(() => {
    if (!path || !key) return;
    const ctrl = new AbortController();
    api<T>(path, { signal: ctrl.signal })
      .then((data) => setState({ path, key, data }))
      .catch((error) => {
        if (!ctrl.signal.aborted) setState((s) => ({ path, key, data: s.path === path ? s.data : undefined, error }));
      });
    return () => ctrl.abort();
  }, [path, key]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  const setData = useCallback((update: (current: T) => T) => {
    setState((s) => (s.data === undefined ? s : { ...s, data: update(s.data) }));
  }, []);

  const samePath = state.path === path;
  return {
    data: samePath ? state.data : undefined,
    error: state.key === key ? state.error : undefined,
    loading: !!path && state.key !== key,
    reload,
    setData,
  };
}

// Refetch when a booking changes elsewhere (another desk, the customer's
// app, a payment landing), or after a missed-events resync.
export function useBookingEvents(reload: () => void) {
  useLiveEvent(
    (type) => type.startsWith('booking_'),
    () => reload(),
  );
}
