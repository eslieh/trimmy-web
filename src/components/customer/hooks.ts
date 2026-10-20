'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { errorMessage } from '@/lib/api';

// Load something for a key (null = don't load yet). The result is tied to the
// key it was loaded for, so a changed key never shows the previous answer as
// if it were current; `stale` keeps the last data around for reloads.
export function useLoad<T>(key: string | null, load: () => Promise<T>, fallbackError?: string) {
  const [state, setState] = useState<{ key: string | null; data?: T; error?: string }>({ key: null });
  const [nonce, setNonce] = useState(0);
  const fullKey = key === null ? null : `${key}#${nonce}`;
  const loader = useRef(load);
  useEffect(() => {
    loader.current = load;
  });

  useEffect(() => {
    if (fullKey === null) return;
    let live = true;
    loader.current().then(
      (data) => live && setState({ key: fullKey, data }),
      (err) => live && setState({ key: fullKey, error: errorMessage(err, fallbackError) }),
    );
    return () => {
      live = false;
    };
  }, [fullKey, fallbackError]);

  const current = state.key === fullKey;
  const reload = useCallback(() => setNonce((n) => n + 1), []);
  const setData = useCallback((data: T) => setState((s) => ({ ...s, data, error: undefined })), []);
  return {
    data: current ? state.data : undefined,
    stale: state.data,
    error: current ? state.error : undefined,
    loading: fullKey !== null && !current,
    reload,
    setData,
  };
}

// The current time, without reading the clock during render: ticks every
// 30s (or every second for countdowns); 0 on the server and while hydrating.
function makeClock(ms: number) {
  let now = 0;
  let timer: ReturnType<typeof setInterval> | null = null;
  const listeners = new Set<() => void>();
  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    if (!timer) {
      now = Date.now();
      timer = setInterval(() => {
        now = Date.now();
        listeners.forEach((l) => l());
      }, ms);
      queueMicrotask(() => listeners.forEach((l) => l()));
    }
    return () => {
      listeners.delete(listener);
      if (!listeners.size && timer) {
        clearInterval(timer);
        timer = null;
      }
    };
  };
  return { subscribe, get: () => now };
}

const slowClock = makeClock(30_000);
const fastClock = makeClock(1_000);

export function useNow(everySecond = false): number {
  const clock = everySecond ? fastClock : slowClock;
  return useSyncExternalStore(clock.subscribe, clock.get, () => 0);
}

// ─── Cart ───────────────────────────────────────────────────────────────
// The services picked on a business profile, kept per business in
// localStorage so the booking flow (and a reload) still has them.

const cartKey = (businessId: string) => `trimmy.cart.${businessId}`;
const cartListeners = new Set<() => void>();
const cartCache = new Map<string, { raw: string | null; ids: string[] }>();
const EMPTY: string[] = [];

function readCart(businessId: string): string[] {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(cartKey(businessId));
  } catch {
    // Storage blocked (private mode): the cart just won't survive a reload.
    raw = memoryCart.get(businessId) ?? null;
  }
  const cached = cartCache.get(businessId);
  if (cached && cached.raw === raw) return cached.ids;
  let ids: string[] = EMPTY;
  try {
    const parsed = raw ? JSON.parse(raw) : null;
    if (Array.isArray(parsed)) ids = parsed.filter((x): x is string => typeof x === 'string');
  } catch {
    ids = EMPTY;
  }
  cartCache.set(businessId, { raw, ids });
  return ids;
}

const memoryCart = new Map<string, string>();

export function setCart(businessId: string, ids: string[]) {
  const raw = JSON.stringify(ids);
  try {
    if (ids.length) window.localStorage.setItem(cartKey(businessId), raw);
    else window.localStorage.removeItem(cartKey(businessId));
  } catch {
    memoryCart.set(businessId, raw);
  }
  cartListeners.forEach((l) => l());
}

function subscribeCart(listener: () => void) {
  cartListeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key?.startsWith('trimmy.cart.')) listener();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    cartListeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

export function useCart(businessId: string) {
  const ids = useSyncExternalStore(subscribeCart, () => readCart(businessId), () => EMPTY);
  const toggle = useCallback(
    (serviceId: string) => {
      const current = readCart(businessId);
      setCart(businessId, current.includes(serviceId) ? current.filter((id) => id !== serviceId) : [...current, serviceId]);
    },
    [businessId],
  );
  const set = useCallback((next: string[]) => setCart(businessId, next), [businessId]);
  return { ids, toggle, set };
}
