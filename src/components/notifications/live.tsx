'use client';

import { useEffect, useEffectEvent, useState, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/components/session';
import { toast } from '@/components/ui/toast';
import type { AppNotification } from '@/types/notification';
import { openNotification } from './routes';
import { receive, refreshUnreadCount, reloadLoaded, resetNotifications } from './store';

// The live stream (GET /me/events through /api/proxy): one per tab, shared by
// every <LiveUpdates> (the customer and the work layouts both mount one).
//
// Read with fetch() rather than EventSource on purpose:
// - the server's heartbeat is an SSE comment (": ping"), which EventSource
//   never surfaces, so a watchdog on it is only possible reading the bytes;
// - EventSource reconnects by itself on a fixed delay and hides the HTTP
//   status, so it would hammer a server that's down or answering 401/429.
// Here nothing reconnects except scheduleReconnect(), with backoff + jitter.
//
// Lifecycle:
// - opened when a signed-in <LiveUpdates> mounts, closed (after a short grace,
//   so moving between layouts doesn't drop it) when the last one unmounts;
// - closed after the tab has been hidden for 5 minutes, reopened (with
//   Last-Event-ID, so the server replays what was missed) when it's back;
// - `ready` resets the backoff; `reconnect` reopens at once; `resync` and a
//   reconnect that can't replay refetch the badge, loaded lists and screens;
// - a watchdog reopens it if nothing at all (pings included) arrives for 3
//   heartbeats; mobile networks drop idle connections without telling anyone.

const EVENTS_URL = '/api/proxy/me/events';
const DEFAULT_HEARTBEAT_MS = 20_000;
const MAX_BACKOFF_MS = 60_000;
const HIDDEN_CLOSE_MS = 5 * 60_000;
const RELEASE_GRACE_MS = 2_000;
const LISTENER_DEBOUNCE_MS = 600;
const OFFLINE_GRACE_MS = 4_000;
// Replays after a long absence shouldn't pop a stack of old toasts.
const TOAST_MAX_AGE_MS = 10 * 60_000;
const SEEN_LIMIT = 200;

// ─── SSE parsing ──────────────────────────────────────────────

type SseEvent = { event: string; data: string; id: string | null };

function sseParser(onEvent: (e: SseEvent) => void): (chunk: string) => void {
  let buffer = '';
  let event = '';
  let data: string[] = [];
  let id: string | null = null;
  return (chunk) => {
    buffer += chunk;
    for (let m = /\r\n|\n|\r/.exec(buffer); m; m = /\r\n|\n|\r/.exec(buffer)) {
      // A lone CR at the end may be the first half of a CRLF split across chunks.
      if (m[0] === '\r' && m.index === buffer.length - 1) break;
      const line = buffer.slice(0, m.index);
      buffer = buffer.slice(m.index + m[0].length);
      if (line === '') {
        if (data.length || event) onEvent({ event: event || 'message', data: data.join('\n'), id });
        event = '';
        data = [];
        id = null;
        continue;
      }
      if (line.startsWith(':')) continue; // a comment: the heartbeat
      const colon = line.indexOf(':');
      const field = colon === -1 ? line : line.slice(0, colon);
      let value = colon === -1 ? '' : line.slice(colon + 1);
      if (value.startsWith(' ')) value = value.slice(1);
      if (field === 'event') event = value;
      else if (field === 'data') data.push(value);
      else if (field === 'id') id = value;
    }
  };
}

// ─── Connection status (for the offline banner) ───────────────

// When the stream went down while it should be up; null while it's up, or
// closed on purpose (signed out, tab hidden for long).
let downSince: number | null = null;
const statusSubscribers = new Set<() => void>();

function setDown(down: boolean) {
  const next = down ? (downSince ?? Date.now()) : null;
  if (next === downSince) return;
  downSince = next;
  statusSubscribers.forEach((fn) => fn());
}

function subscribeStatus(fn: () => void) {
  statusSubscribers.add(fn);
  return () => {
    statusSubscribers.delete(fn);
  };
}

// ─── Fan-out to screens ──────────────────────────────────────

type Listener = (n: AppNotification | null) => void;
const listeners = new Set<Listener>();

function emit(n: AppNotification | null) {
  listeners.forEach((fn) => fn(n));
}

// ─── Incoming notifications ──────────────────────────────────

// Recently seen ids, apart from the lists (which may not be loaded), so a
// replayed event never counts or toasts twice.
const seen = new Set<string>();
let navigate: (href: string) => void = (href) => window.location.assign(href);
let onUnauthorized: () => void = () => {};

export function receiveNotification(n: AppNotification): void {
  if (!n || typeof n.notificationId !== 'string' || seen.has(n.notificationId)) return;
  seen.add(n.notificationId);
  if (seen.size > SEEN_LIMIT) seen.delete(seen.values().next().value as string);
  const isNew = receive(n);
  const age = Date.now() - new Date(n.createdAt).getTime();
  if (isNew && !n.readAt && !(age > TOAST_MAX_AGE_MS)) {
    toast({ title: n.title, body: n.body, onClick: () => openNotification(n, navigate) });
  }
  // Even when the inbox already had it, a screen showing the data may not.
  emit(n);
}

function resync() {
  reloadLoaded();
  emit(null);
}

// ─── The connection ──────────────────────────────────────────

type Conn = { abort: AbortController; ready: boolean };

let userId: string | null = null;
let holders = 0;
let current: Conn | null = null;
let attempts = 0;
let heartbeatMs = DEFAULT_HEARTBEAT_MS;
let lastEventId: string | null = null;
let everReady = false;
let paused = false; // hidden for too long
let lastActivity = 0;
let retryTimer: ReturnType<typeof setTimeout> | undefined;
let watchdogTimer: ReturnType<typeof setTimeout> | undefined;
let hiddenTimer: ReturnType<typeof setTimeout> | undefined;
let releaseTimer: ReturnType<typeof setTimeout> | undefined;
let installed = false;

const wanted = () => userId !== null && holders > 0 && !paused;

function stopStream() {
  clearTimeout(retryTimer);
  clearTimeout(watchdogTimer);
  retryTimer = watchdogTimer = undefined;
  const conn = current;
  current = null; // first, so the dying reader knows it was closed on purpose
  conn?.abort.abort();
}

// Closes whatever is open and tries again: `delayMs`, or the next backoff
// step (1s, 2s, 4s … 60s, each a random 50–100% of that).
function scheduleReconnect(delayMs?: number, opts: { down?: boolean } = {}) {
  stopStream();
  if (!wanted()) return;
  if (opts.down !== false) setDown(true);
  const cap = Math.min(MAX_BACKOFF_MS, 1000 * 2 ** attempts);
  const wait = delayMs ?? cap / 2 + Math.random() * (cap / 2);
  attempts += 1;
  retryTimer = setTimeout(connect, wait);
}

function armWatchdog() {
  lastActivity = Date.now();
  clearTimeout(watchdogTimer);
  watchdogTimer = setTimeout(() => {
    // Silent for 3 heartbeats: the connection is dead even if nobody said so.
    // Straight away if it had been working; with backoff while connecting.
    scheduleReconnect(current?.ready ? 0 : undefined);
  }, heartbeatMs * 3);
}

async function connect() {
  retryTimer = undefined;
  if (!wanted() || current) return;
  // Known offline: don't spend a request; the `online` event reconnects.
  if (navigator.onLine === false) {
    scheduleReconnect();
    return;
  }
  const conn: Conn = { abort: new AbortController(), ready: false };
  current = conn;
  armWatchdog(); // also bounds a request that never answers

  const headers: Record<string, string> = { Accept: 'text/event-stream' };
  // We open each stream ourselves, so we resend the cursor ourselves.
  if (lastEventId) headers['Last-Event-ID'] = lastEventId;
  let res: Response;
  try {
    res = await fetch(EVENTS_URL, { headers, cache: 'no-store', credentials: 'same-origin', signal: conn.abort.signal });
  } catch {
    if (current === conn) scheduleReconnect();
    return;
  }
  if (current !== conn) {
    res.body?.cancel().catch(() => {});
    return;
  }
  if (!res.ok || !res.body || !res.headers.get('content-type')?.includes('text/event-stream')) {
    res.body?.cancel().catch(() => {});
    if (res.status === 401) {
      // The proxy already tried a refresh: the session is gone. Let the
      // session re-read (which unmounts us if signed out); retry slowly.
      attempts = Math.max(attempts, 6);
      onUnauthorized();
      scheduleReconnect(undefined, { down: false });
      return;
    }
    if (res.status === 429) attempts = Math.max(attempts, 5); // too many streams: back off hard
    scheduleReconnect();
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  const parse = sseParser((e) => {
    if (current === conn) onEvent(conn, e);
  });
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (current !== conn) return;
      if (done) break;
      armWatchdog();
      parse(decoder.decode(value, { stream: true }));
    }
  } catch {
    // Network error mid-stream (or our own abort; checked below).
  }
  if (current !== conn) return;
  // The server or the network ended it. Backoff restarts from 0 if it had been up.
  scheduleReconnect();
}

function onEvent(conn: Conn, e: SseEvent) {
  switch (e.event) {
    case 'ready': {
      const first = !everReady;
      everReady = true;
      conn.ready = true;
      attempts = 0;
      setDown(false);
      try {
        const seconds = JSON.parse(e.data)?.heartbeatSeconds;
        if (typeof seconds === 'number' && seconds > 0) heartbeatMs = seconds * 1000;
      } catch {
        // Keep the default.
      }
      armWatchdog();
      if (first) void refreshUnreadCount();
      // Reopened with no cursor: whatever came in between won't be replayed.
      else if (!lastEventId) resync();
      break;
    }
    case 'notification': {
      if (e.id) lastEventId = e.id;
      let n: AppNotification | null = null;
      try {
        n = JSON.parse(e.data) as AppNotification;
      } catch {
        // Malformed: skip it; the inbox still has the row.
      }
      if (n) receiveNotification(n);
      break;
    }
    case 'resync':
      resync();
      break;
    case 'reconnect':
      // The server is rotating this stream (token lifetime, deploys). Before
      // `ready` it means "can't take you now": back off instead of looping.
      scheduleReconnect(conn.ready ? 0 : undefined, { down: false });
      break;
  }
}

// ─── Tab and network events ──────────────────────────────────

function onVisibility() {
  clearTimeout(hiddenTimer);
  if (document.hidden) {
    hiddenTimer = setTimeout(() => {
      paused = true;
      stopStream();
      setDown(false); // closed on purpose: not "offline"
    }, HIDDEN_CLOSE_MS);
    return;
  }
  if (paused) {
    paused = false;
    attempts = 0;
    void connect();
  } else if (current && Date.now() - lastActivity > heartbeatMs * 3) {
    // Back from sleep: timers were frozen, the socket is likely dead.
    scheduleReconnect(0);
  } else if (!current && retryTimer && wanted()) {
    // Someone's looking now: don't make them sit out a long backoff step.
    scheduleReconnect(0, { down: false });
  }
}

function onOnline() {
  if (!wanted() || current?.ready) return;
  attempts = 0;
  scheduleReconnect(0, { down: false });
}

function install() {
  if (installed) return;
  installed = true;
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('online', onOnline);
  if (document.hidden) onVisibility();
}

function uninstall() {
  if (!installed) return;
  installed = false;
  document.removeEventListener('visibilitychange', onVisibility);
  window.removeEventListener('online', onOnline);
  clearTimeout(hiddenTimer);
  paused = false;
}

function forgetAccount() {
  stopStream();
  setDown(false);
  userId = null;
  lastEventId = null;
  everReady = false;
  attempts = 0;
  seen.clear();
  resetNotifications();
}

function retain(uid: string) {
  clearTimeout(releaseTimer);
  if (userId !== uid) {
    if (userId !== null) forgetAccount();
    userId = uid;
  }
  holders += 1;
  install();
  if (!current && !retryTimer && !paused) void connect();
}

function release() {
  holders = Math.max(0, holders - 1);
  if (holders > 0) return;
  clearTimeout(releaseTimer);
  releaseTimer = setTimeout(() => {
    if (holders > 0) return;
    stopStream();
    setDown(false);
    uninstall();
  }, RELEASE_GRACE_MS);
}

// ─── Components ──────────────────────────────────────────────

export function LiveUpdates({ children }: { children: React.ReactNode }) {
  const { session, refresh } = useSession();
  const router = useRouter();
  const uid = session?.user.id ?? null;

  useEffect(() => {
    navigate = (href) => router.push(href);
    onUnauthorized = refresh;
  }, [router, refresh]);

  useEffect(() => {
    if (!uid) {
      if (userId !== null) forgetAccount(); // signed out
      return;
    }
    retain(uid);
    return release;
  }, [uid]);

  return (
    <>
      {children}
      <OfflineBanner />
    </>
  );
}

// Run `onEvent` when a live notification whose type matches arrives (e.g. a
// booking change, to refetch the day), or with null when events may have been
// missed (a resync: refetch whatever is on screen). A burst folds into one
// call (null if any of it was a resync), and nothing runs while the tab is
// hidden: it runs once when the tab is visible again.
export function useLiveEvent(
  matches: (type: string) => boolean,
  onEvent: (notification: AppNotification | null) => void,
): void {
  const match = useEffectEvent(matches);
  const fire = useEffectEvent(onEvent);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let pending: { n: AppNotification | null } | null = null;
    let waiting = false;

    const flush = () => {
      timer = undefined;
      if (document.hidden) {
        if (!waiting) {
          waiting = true;
          document.addEventListener('visibilitychange', onVisible);
        }
        return;
      }
      const p = pending;
      pending = null;
      if (p) fire(p.n);
    };
    const onVisible = () => {
      if (document.hidden) return;
      waiting = false;
      document.removeEventListener('visibilitychange', onVisible);
      flush();
    };
    const listener: Listener = (n) => {
      if (n && !match(n.type)) return;
      pending = pending && pending.n === null ? pending : { n };
      clearTimeout(timer);
      timer = setTimeout(flush, LISTENER_DEBOUNCE_MS);
    };

    listeners.add(listener);
    return () => {
      listeners.delete(listener);
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);
}

function subscribeOnline(fn: () => void) {
  window.addEventListener('online', fn);
  window.addEventListener('offline', fn);
  return () => {
    window.removeEventListener('online', fn);
    window.removeEventListener('offline', fn);
  };
}

// "You're offline." in a thin black bar laid over the top of the page: it
// moves nothing. Shown when the browser says it's offline, or the stream has
// been down for over 4s (a blip, or the stream rotating, shouldn't flash it).
function OfflineBanner() {
  const browserOffline = useSyncExternalStore(subscribeOnline, () => !navigator.onLine, () => false);
  const since = useSyncExternalStore(subscribeStatus, () => downSince, () => null);
  // The `since` whose grace period has run out (set from a timer, not render).
  const [expired, setExpired] = useState<number | null>(null);

  useEffect(() => {
    if (since === null) return;
    const timer = setTimeout(() => setExpired(since), Math.max(0, OFFLINE_GRACE_MS - (Date.now() - since)));
    return () => clearTimeout(timer);
  }, [since]);

  if (!browserOffline && (since === null || expired !== since)) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-0 z-[70] flex h-6 items-center justify-center gap-1.5 bg-black px-4 text-xs font-semibold text-white"
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M3 3l18 18M8.5 16.5a5 5 0 0 1 7 0M5 12.9a10 10 0 0 1 5.2-2.8M19 12.9a10 10 0 0 0-2.1-1.6M2 8.8a15 15 0 0 1 4.3-2.6M22 8.8A15 15 0 0 0 11 5M12 20h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      You&apos;re offline.
    </div>
  );
}
