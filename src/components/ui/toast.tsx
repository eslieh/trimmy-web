'use client';

import { useEffect, useState } from 'react';
import { cx } from '@/lib/format';

// Small, app-wide toasts: toast('Saved'), toast.error('Couldn't save'), or
// toast({ title, body, onClick }) for notifications. Newest on top, four max,
// each gone after a few seconds.
type Item = { id: number; title: string; body?: string; tone: 'info' | 'error' | 'success'; onClick?: () => void };
type Input = string | { title: string; body?: string; onClick?: () => void };

let nextId = 1;
let listener: ((items: Item[]) => void) | null = null;
let items: Item[] = [];

function push(input: Input, tone: Item['tone']) {
  const item: Item = typeof input === 'string' ? { id: nextId++, title: input, tone } : { id: nextId++, tone, ...input };
  items = [item, ...items].slice(0, 4);
  listener?.(items);
  setTimeout(() => {
    items = items.filter((i) => i.id !== item.id);
    listener?.(items);
  }, tone === 'error' ? 6000 : 4500);
}

export const toast = Object.assign((input: Input) => push(input, 'info'), {
  success: (input: Input) => push(input, 'success'),
  error: (input: Input) => push(input, 'error'),
});

export function Toaster() {
  const [current, setCurrent] = useState<Item[]>([]);
  useEffect(() => {
    listener = setCurrent;
    return () => {
      listener = null;
    };
  }, []);
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 top-3 z-[60] flex flex-col items-center gap-2 px-3 sm:top-auto sm:bottom-6 sm:right-6 sm:left-auto sm:items-end">
      {current.map((t) => (
        <button
          key={t.id}
          onClick={() => {
            t.onClick?.();
            setCurrent((c) => c.filter((x) => x.id !== t.id));
          }}
          className={cx(
            'pointer-events-auto w-full max-w-sm rounded-card border bg-white px-4 py-3 text-left shadow-raised',
            t.tone === 'error' ? 'border-danger/30' : t.tone === 'success' ? 'border-success/30' : 'border-line',
          )}
        >
          <p className={cx('text-sm font-semibold', t.tone === 'error' && 'text-danger')}>{t.title}</p>
          {t.body ? <p className="mt-0.5 line-clamp-2 text-[13px] text-ink-2">{t.body}</p> : null}
        </button>
      ))}
    </div>
  );
}
