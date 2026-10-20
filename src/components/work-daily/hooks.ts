'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { businessNow } from './time';

// True when the viewport matches `query` (false while server rendering).
export function useMedia(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query);
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

// The business's date and minute of the day, ticking every 30 seconds.
export function useBusinessClock(timezone: string | undefined) {
  const [now, setNow] = useState(() => businessNow(timezone));
  useEffect(() => {
    const tick = () => setNow(businessNow(timezone));
    const t = setInterval(tick, 30_000);
    const first = setTimeout(tick, 0); // the timezone may have just arrived
    return () => {
      clearInterval(t);
      clearTimeout(first);
    };
  }, [timezone]);
  return now;
}

// Re-run `fn` every `ms` while the tab is visible: a desk screen left open
// all day stays current even if a live event is missed.
export function useInterval(fn: () => void, ms: number) {
  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState === 'visible') fn();
    }, ms);
    return () => clearInterval(t);
  }, [fn, ms]);
}

// Mirror page state into the URL without a navigation (so reloads and shared links keep it).
export function replaceQuery(params: Record<string, string | null | undefined>) {
  const url = new URL(window.location.href);
  for (const [k, v] of Object.entries(params)) {
    if (v) url.searchParams.set(k, v);
    else url.searchParams.delete(k);
  }
  window.history.replaceState(window.history.state, '', url);
}
