'use client';

import { useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Spinner } from '@/components/ui/button';
import { cx, relativeTime } from '@/lib/format';
import { NotificationIcon } from './icon';
import { openNotification } from './routes';
import { loadPreview, markAllRead, refreshUnreadCount, useNotifications } from './store';

// The bell in both top bars: the unread badge (kept current by the live
// stream, refreshed on mount) and a dropdown with the latest five and
// "See all". The list is only fetched when the dropdown opens.
export function NotificationBell() {
  const router = useRouter();
  const unread = useNotifications((s) => s.unreadCount);
  const preview = useNotifications((s) => s.preview);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    void refreshUnreadCount();
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next) {
      setError(false);
      loadPreview().catch(() => setError(true));
    }
  };

  const badge = unread ? (unread > 9 ? '9+' : String(unread)) : null;

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
        aria-expanded={open}
        aria-controls={panelId}
        className="relative grid size-10 place-items-center rounded-full bg-surface-2 hover:bg-surface-3"
      >
        <NotificationIcon type="bell" />
        {badge ? (
          <span className="absolute -top-0.5 -right-0.5 grid h-5 min-w-5 place-items-center rounded-full border-2 border-white bg-brand-pink px-1 text-[10px] leading-none font-bold text-white">
            {badge}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          id={panelId}
          className="fixed inset-x-3 top-16 z-40 overflow-hidden rounded-card border border-line bg-white shadow-raised sm:absolute sm:inset-x-auto sm:top-12 sm:right-0 sm:w-96"
        >
          <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
            <p className="font-bold">Notifications</p>
            {unread ? (
              <button
                type="button"
                onClick={() => markAllRead().catch(() => setError(true))}
                className="text-sm font-semibold text-brand hover:underline"
              >
                Mark all read
              </button>
            ) : null}
          </div>
          <div className="max-h-[60dvh] overflow-y-auto">
            {preview === null ? (
              error ? (
                <p className="px-4 py-8 text-center text-sm text-ink-2">Couldn&apos;t load notifications.</p>
              ) : (
                <div className="grid place-items-center py-8 text-ink-3"><Spinner /></div>
              )
            ) : preview.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-ink-2">No notifications yet.</p>
            ) : (
              <ul>
                {preview.map((n) => (
                  <li key={n.notificationId}>
                    <button
                      type="button"
                      onClick={() => {
                        setOpen(false);
                        openNotification(n, (href) => router.push(href));
                      }}
                      className={cx('flex w-full gap-3 px-4 py-3 text-left hover:bg-surface-2', !n.readAt && 'bg-brand/5')}
                    >
                      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-3 text-ink">
                        <NotificationIcon type={n.type} size={16} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-start gap-2">
                          <span className={cx('flex-1 text-sm', n.readAt ? 'font-medium' : 'font-bold')}>{n.title}</span>
                          <span className="shrink-0 text-xs text-ink-3">{relativeTime(n.createdAt)}</span>
                        </span>
                        <span className="mt-0.5 line-clamp-2 block text-[13px] text-ink-2">{n.body}</span>
                      </span>
                      {!n.readAt ? <span className="mt-1.5 size-2 shrink-0 rounded-full bg-brand" aria-label="Unread" /> : null}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <Link
            href="/notifications"
            onClick={() => setOpen(false)}
            className="block border-t border-line px-4 py-3 text-center text-sm font-semibold hover:bg-surface-2"
          >
            See all
          </Link>
        </div>
      ) : null}
    </div>
  );
}
