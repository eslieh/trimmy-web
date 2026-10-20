'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, errorMessage } from '@/lib/api';

type State<T> = { key: string | null; data: T | undefined; error: string | null };

// GET `path` and keep the result. While a new path (or a reload) is loading,
// the previous data stays on screen, so filters don't flash empty. A null
// path fetches nothing. `mutate` patches the data in place after a write.
export function useApi<T>(path: string | null) {
  const [version, setVersion] = useState(0);
  const [state, setState] = useState<State<T>>({ key: null, data: undefined, error: null });
  const key = path ? `${version}:${path}` : null;

  useEffect(() => {
    if (!path || !key) return;
    const ctrl = new AbortController();
    api<T>(path, { signal: ctrl.signal }).then(
      (data) => setState({ key, data, error: null }),
      (err) => {
        if (!ctrl.signal.aborted) setState((s) => ({ key, data: s.data, error: errorMessage(err) }));
      },
    );
    return () => ctrl.abort();
  }, [path, key]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  const mutate = useCallback((fn: (data: T) => T) => {
    setState((s) => (s.data === undefined ? s : { ...s, data: fn(s.data) }));
  }, []);

  const settled = key !== null && state.key === key;
  return {
    data: state.data,
    error: settled ? state.error : null,
    loading: key !== null && !settled,
    reload,
    mutate,
  };
}
