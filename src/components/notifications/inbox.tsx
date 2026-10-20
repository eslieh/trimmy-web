'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button, Spinner } from '@/components/ui/button';
import { EmptyState, PageHeader, Tabs } from '@/components/ui/misc';
import { toast } from '@/components/ui/toast';
import { api, errorMessage } from '@/lib/api';
import { cx } from '@/lib/format';
import type { AppNotification } from '@/types/notification';
import { NotificationIcon } from './icon';
import { receiveNotification } from './live';
import { appOnlyHint, openNotification } from './routes';
import { loadList, loadMore, markAllRead, useNotifications, type InboxFilter } from './store';

const DAY_MS = 24 * 60 * 60 * 1000;
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

// Today / Yesterday / Earlier, keeping the server's newest-first order.
function groupByDay(list: AppNotification[]) {
  const today = startOfDay(new Date());
  const groups: Record<'Today' | 'Yesterday' | 'Earlier', AppNotification[]> = { Today: [], Yesterday: [], Earlier: [] };
  for (const n of list) {
    const day = startOfDay(new Date(n.createdAt));
    groups[day >= today ? 'Today' : day >= today - DAY_MS ? 'Yesterday' : 'Earlier'].push(n);
  }
  return (Object.keys(groups) as (keyof typeof groups)[]).filter((k) => groups[k].length).map((title) => ({ title, items: groups[title] }));
}

// Relative today ("5m ago"), the time yesterday (the heading says which day),
// the date beyond that.
function when(iso: string): string {
  const date = new Date(iso);
  const today = startOfDay(new Date());
  if (startOfDay(date) >= today) {
    const minutes = Math.floor((Date.now() - date.getTime()) / 60_000);
    if (minutes < 1) return 'Just now';
    return minutes < 60 ? `${minutes}m ago` : `${Math.floor(minutes / 60)}h ago`;
  }
  if (startOfDay(date) >= today - DAY_MS) return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

// The inbox: everything for this account across customer and business, newest
// first. Live arrivals are prepended by the stream (through the shared store).
// A click marks the row read and opens the same page its toast would.
export function Inbox() {
  const router = useRouter();
  const list = useNotifications((s) => s.list);
  const loadedFilter = useNotifications((s) => s.filter);
  const nextCursor = useNotifications((s) => s.nextCursor);
  const unread = useNotifications((s) => s.unreadCount);

  const [filter, setFilter] = useState<InboxFilter>('all');
  const [loadError, setLoadError] = useState('');
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreFailed, setMoreFailed] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const [sending, setSending] = useState(false);
  const sentinel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    loadList(filter).catch((err) => {
      if (!cancelled) setLoadError(errorMessage(err, "Couldn't load your notifications."));
    });
    return () => {
      cancelled = true;
    };
  }, [filter]);

  const changeFilter = (next: InboxFilter) => {
    setLoadError('');
    setMoreFailed(false);
    setFilter(next);
  };

  const more = useCallback(async () => {
    if (loadingMore) return;
    setLoadingMore(true);
    setMoreFailed(false);
    try {
      await loadMore();
    } catch {
      setMoreFailed(true); // the button below retries; the sentinel doesn't loop
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore]);

  // Infinite scroll: load the next page as the end comes into view.
  const ready = loadedFilter === filter;
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !ready || !nextCursor || moreFailed || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) void more();
    }, { rootMargin: '400px' });
    io.observe(el);
    return () => io.disconnect();
  }, [ready, nextCursor, moreFailed, more]);

  const sections = useMemo(() => groupByDay(list), [list]);

  const markAll = async () => {
    setMarkingAll(true);
    try {
      await markAllRead();
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't mark them as read."));
    } finally {
      setMarkingAll(false);
    }
  };

  const sendTest = async () => {
    setSending(true);
    try {
      // Goes through the whole pipeline; the stream delivers it too (deduped).
      receiveNotification(await api<AppNotification>('/me/notifications/test', { method: 'POST' }));
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't send a test notification."));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Notifications"
        actions={
          <Link href="/account/notifications" className="text-sm font-semibold text-ink-2 hover:text-ink">
            Settings
          </Link>
        }
      />

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Tabs<InboxFilter>
          value={filter}
          onChange={changeFilter}
          options={[
            { key: 'all', label: 'All' },
            { key: 'unread', label: 'Unread', badge: unread ?? undefined },
          ]}
        />
        <div className="flex items-center gap-2">
          {process.env.NODE_ENV !== 'production' ? (
            <Button variant="ghost" size="sm" onClick={sendTest} loading={sending}>
              Send test notification
            </Button>
          ) : null}
          {unread ? (
            <Button variant="secondary" size="sm" onClick={markAll} loading={markingAll}>
              Mark all read
            </Button>
          ) : null}
        </div>
      </div>

      {!ready ? (
        loadError ? (
          <EmptyState
            title="Couldn't load notifications"
            body={loadError}
            action={<Button variant="secondary" size="sm" onClick={() => { setLoadError(''); loadList(filter).catch((err) => setLoadError(errorMessage(err))); }}>Try again</Button>}
          />
        ) : (
          <div className="grid place-items-center py-16 text-ink-3"><Spinner /></div>
        )
      ) : sections.length === 0 ? (
        <EmptyState
          title={filter === 'unread' ? "You're all caught up" : 'No notifications yet'}
          body="Booking updates, reminders and payouts will show up here."
        />
      ) : (
        <div className="flex flex-col gap-6">
          {sections.map((section) => (
            <section key={section.title}>
              <h2 className="mb-2 text-sm font-bold text-ink-2">{section.title}</h2>
              <ul className="overflow-hidden rounded-card border border-line bg-white shadow-card">
                {section.items.map((n) => (
                  <li key={n.notificationId} className="border-b border-line last:border-b-0">
                    <Row n={n} onOpen={() => openNotification(n, (href) => router.push(href), null)} />
                  </li>
                ))}
              </ul>
            </section>
          ))}

          <div ref={sentinel} />
          {nextCursor ? (
            <div className="flex justify-center">
              <Button variant="secondary" size="sm" onClick={more} loading={loadingMore}>
                {moreFailed ? "Couldn't load more. Try again" : 'Load more'}
              </Button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

function Row({ n, onOpen }: { n: AppNotification; onOpen: () => void }) {
  const hint = appOnlyHint(n.type);
  return (
    <button type="button" onClick={onOpen} className={cx('flex w-full gap-3 px-4 py-4 text-left hover:bg-surface-2', !n.readAt && 'bg-brand/5')}>
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-surface-3 text-ink">
        <NotificationIcon type={n.type} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-start gap-2">
          <span className={cx('flex-1 text-[15px]', n.readAt ? 'font-medium' : 'font-bold')}>{n.title}</span>
          <span className="shrink-0 text-xs text-ink-3">{when(n.createdAt)}</span>
        </span>
        <span className="mt-0.5 block text-sm text-ink-2">{n.body}</span>
        {hint ? <span className="mt-1 block text-xs font-semibold text-ink-3">{hint}</span> : null}
      </span>
      {!n.readAt ? <span className="mt-2 size-2 shrink-0 rounded-full bg-brand" aria-label="Unread" /> : null}
    </button>
  );
}
