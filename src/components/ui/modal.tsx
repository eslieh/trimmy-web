'use client';

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { cx } from '@/lib/format';

// A dialog: centred on desktop, a bottom sheet on phones. Escape or a click
// outside closes it (unless `locked`, e.g. while saving); focus moves in and
// is restored after.
export function Modal({
  open, onClose, title, children, footer, locked, wide,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  locked?: boolean;
  wide?: boolean;
}) {
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    panel.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !locked) onClose();
    };
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, [open, locked, onClose]);

  if (!open || typeof document === 'undefined') return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-6" onMouseDown={() => !locked && onClose()}>
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onMouseDown={(e) => e.stopPropagation()}
        className={cx(
          'flex max-h-[92dvh] w-full flex-col rounded-t-sheet bg-white shadow-raised outline-none sm:rounded-sheet',
          wide ? 'sm:max-w-2xl' : 'sm:max-w-md',
        )}
      >
        {title ? (
          <div className="flex items-center justify-between gap-4 px-6 pt-5 pb-2">
            <h2 className="text-xl font-bold">{title}</h2>
            {!locked ? (
              <button onClick={onClose} aria-label="Close" className="grid size-9 place-items-center rounded-full hover:bg-surface-2">
                ✕
              </button>
            ) : null}
          </div>
        ) : null}
        <div className="overflow-y-auto px-6 py-3">{children}</div>
        {footer ? <div className="border-t border-line px-6 py-4">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  );
}
