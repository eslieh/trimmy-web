'use client';

import { useSyncExternalStore } from 'react';
import { api, toQuery } from '@/lib/api';
import type { AppNotification, NotificationPage } from '@/types/notification';

// One notifications cache per tab, shared by the bell, its preview, the inbox
// page and the live stream, so a notification that arrives (or is read) shows
// the same everywhere without refetching. A plain module store read through
// useSyncExternalStore: no provider, and it survives navigating between the
// customer and work layouts.

export type InboxFilter = 'all' | 'unread';

type State = {
  // null until first fetched (the bell shows no badge rather than a wrong 0).
  unreadCount: number | null;
  // The inbox page's list; `filter` is null until it's been loaded.
  list: AppNotification[];
  filter: InboxFilter | null;
  nextCursor: string | null;
  // The bell dropdown's latest few (null until opened once).
  preview: AppNotification[] | null;
};

const PREVIEW_SIZE = 5;
const PAGE_SIZE = 20;

const EMPTY: State = { unreadCount: null, list: [], filter: null, nextCursor: null, preview: null };
let state: State = EMPTY;
const subscribers = new Set<() => void>();

function set(patch: Partial<State> | ((s: State) => Partial<State>)) {
  state = { ...state, ...(typeof patch === 'function' ? patch(state) : patch) };
  subscribers.forEach((fn) => fn());
}

function subscribe(fn: () => void) {
  subscribers.add(fn);
  return () => {
    subscribers.delete(fn);
  };
}

export function useNotifications<T>(select: (s: State) => T): T {
  return useSyncExternalStore(subscribe, () => select(state), () => select(EMPTY));
}

export function notificationsState(): State {
  return state;
}

// Bumped on reset and on every list (re)load, so a slow response for an
// earlier filter or account never overwrites a newer one.
let listGeneration = 0;
let countGeneration = 0;

const mapBoth = (s: State, fn: (n: AppNotification) => AppNotification) => ({
  list: s.list.map(fn),
  preview: s.preview?.map(fn) ?? null,
});

// Coalesced: the bell mounting, a resync and a reconnect at the same moment
// make one request.
let countInFlight: Promise<void> | null = null;
export function refreshUnreadCount(): Promise<void> {
  if (countInFlight) return countInFlight;
  const gen = ++countGeneration;
  countInFlight = api<{ unreadCount: number }>('/me/notifications/unread-count')
    .then(({ unreadCount }) => {
      if (gen === countGeneration) set({ unreadCount });
    })
    .catch(() => {
      // The badge is a hint: keep the last known count.
    })
    .finally(() => {
      countInFlight = null;
    });
  return countInFlight;
}

function setCount(unreadCount: number) {
  countGeneration++; // newer than any count request still in flight
  set({ unreadCount });
}

// Replaces the inbox list with the newest page for `filter`.
export async function loadList(filter: InboxFilter): Promise<void> {
  const gen = ++listGeneration;
  const page = await api<NotificationPage>(`/me/notifications${toQuery({ limit: PAGE_SIZE, unread: filter === 'unread' || undefined })}`);
  if (gen !== listGeneration) return;
  countGeneration++;
  set({ list: page.notifications, filter, nextCursor: page.nextCursor, unreadCount: page.unreadCount });
}

// Appends the next (older) page; a no-op on the last page.
export async function loadMore(): Promise<void> {
  const { nextCursor: cursor, filter } = state;
  if (!cursor || !filter) return;
  const gen = listGeneration;
  const page = await api<NotificationPage>(
    `/me/notifications${toQuery({ limit: PAGE_SIZE, cursor, unread: filter === 'unread' || undefined })}`,
  );
  if (gen !== listGeneration || state.nextCursor !== cursor) return;
  const have = new Set(state.list.map((n) => n.notificationId));
  countGeneration++;
  set((s) => ({
    list: [...s.list, ...page.notifications.filter((n) => !have.has(n.notificationId))],
    nextCursor: page.nextCursor,
    unreadCount: page.unreadCount,
  }));
}

export async function loadPreview(): Promise<void> {
  const gen = listGeneration;
  const page = await api<NotificationPage>(`/me/notifications${toQuery({ limit: PREVIEW_SIZE })}`);
  if (gen !== listGeneration) return;
  countGeneration++;
  set({ preview: page.notifications, unreadCount: page.unreadCount });
}

// After a resync: refetch whatever is loaded (the count always).
export function reloadLoaded(): void {
  void refreshUnreadCount();
  if (state.filter) loadList(state.filter).catch(() => {});
  if (state.preview) loadPreview().catch(() => {});
}

// A notification that arrived live. Returns false if it was already here.
export function receive(n: AppNotification): boolean {
  if (state.list.some((x) => x.notificationId === n.notificationId) || state.preview?.some((x) => x.notificationId === n.notificationId)) {
    return false;
  }
  set((s) => ({
    list: s.filter ? [n, ...s.list] : s.list,
    preview: s.preview ? [n, ...s.preview].slice(0, PREVIEW_SIZE) : null,
    unreadCount: s.unreadCount === null ? null : s.unreadCount + (n.readAt ? 0 : 1),
  }));
  // Never fetched yet: get the real number rather than guessing.
  if (state.unreadCount === null) void refreshUnreadCount();
  return true;
}

// Optimistic: the row and badge change before the request lands.
export async function markRead(notificationId: string): Promise<void> {
  const target = state.list.find((n) => n.notificationId === notificationId) ?? state.preview?.find((n) => n.notificationId === notificationId);
  if (target?.readAt) return;
  const now = new Date().toISOString();
  set((s) => ({
    ...mapBoth(s, (n) => (n.notificationId === notificationId ? { ...n, readAt: now } : n)),
    unreadCount: s.unreadCount === null || !target ? s.unreadCount : Math.max(0, s.unreadCount - 1),
  }));
  try {
    const { unreadCount } = await api<{ unreadCount: number }>(`/me/notifications/${encodeURIComponent(notificationId)}/read`, { method: 'POST' });
    setCount(unreadCount);
  } catch {
    // Left read here; the next load corrects it if the server disagrees.
  }
}

export async function markAllRead(): Promise<void> {
  const { unreadCount } = await api<{ unreadCount: number }>('/me/notifications/read-all', { method: 'POST' });
  const now = new Date().toISOString();
  setCount(unreadCount);
  set((s) => mapBoth(s, (n) => (n.readAt ? n : { ...n, readAt: now })));
}

// Signed out or switched account: nothing of the last one stays visible.
export function resetNotifications(): void {
  listGeneration++;
  countGeneration++;
  set(EMPTY);
}
