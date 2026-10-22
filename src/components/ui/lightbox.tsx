'use client';

import Image from 'next/image';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cx } from '@/lib/format';

// Full-screen photo viewer, the web twin of the app's ImageGalleryViewer:
// each photo fits the screen (no scrolling to see it whole), swipe or use the
// arrows / ← → keys to move through them, Esc or ✕ to close. Only the photo
// in view and its neighbours load, so a long portfolio stays light.
export function Lightbox({
  images, index, onClose, label,
}: { images: string[]; index: number | null; onClose: () => void; label: string }) {
  if (index === null || typeof document === 'undefined') return null;
  return createPortal(<Viewer images={images} start={index} onClose={onClose} label={label} />, document.body);
}

function Viewer({ images, start, onClose, label }: { images: string[]; start: number; onClose: () => void; label: string }) {
  const track = useRef<HTMLDivElement>(null);
  const [current, setCurrent] = useState(start);

  const go = useCallback((i: number) => {
    const el = track.current;
    if (!el) return;
    const next = Math.max(0, Math.min(images.length - 1, i));
    el.scrollTo({ left: next * el.clientWidth, behavior: 'smooth' });
  }, [images.length]);

  // Open on the tapped photo, without animating there.
  useEffect(() => {
    const el = track.current;
    if (el) el.scrollLeft = start * el.clientWidth;
  }, [start]);

  useEffect(() => {
    // Capture on window so a dialog underneath (Escape closes it too) never sees these keys.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') go(current + 1);
      else if (e.key === 'ArrowLeft') go(current - 1);
      else return;
      e.stopPropagation();
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey, true);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey, true);
      document.body.style.overflow = overflow;
    };
  }, [current, go, onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={label}
      className="fixed inset-0 z-[60] bg-black animate-fade-in"
      // The dialog underneath closes on a mousedown outside itself; this sits above it.
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div
        ref={track}
        onScroll={(e) => setCurrent(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}
        className="flex h-full snap-x snap-mandatory overflow-x-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {images.map((src, i) => (
          // Tapping the space around a photo closes, like the app.
          <div key={src + i} className="relative h-full w-full shrink-0 snap-center" onClick={onClose}>
            {Math.abs(i - current) <= 1 ? (
              <Image
                src={src}
                alt={`${label}, photo ${i + 1} of ${images.length}`}
                fill
                sizes="100vw"
                priority={i === start}
                unoptimized={!src.startsWith('https://')}
                className="object-contain p-4 sm:p-14"
                onClick={(e) => e.stopPropagation()}
              />
            ) : null}
          </div>
        ))}
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between p-4" style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}>
        {images.length > 1 ? (
          <span className="rounded-full bg-white/15 px-3 py-1 text-sm font-semibold text-white" aria-live="polite">
            {current + 1} / {images.length}
          </span>
        ) : (
          <span />
        )}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close photos"
          className="pointer-events-auto grid size-11 place-items-center rounded-full bg-white/15 text-white transition-colors hover:bg-white/25"
        >
          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>

      {images.length > 1 ? (
        <>
          {current > 0 ? <Arrow side="left" onClick={() => go(current - 1)} /> : null}
          {current < images.length - 1 ? <Arrow side="right" onClick={() => go(current + 1)} /> : null}
        </>
      ) : null}
    </div>
  );
}

// Desktop arrows; on phones a swipe does the same.
function Arrow({ side, onClick }: { side: 'left' | 'right'; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={side === 'left' ? 'Previous photo' : 'Next photo'}
      className={cx(
        'absolute top-1/2 hidden size-12 -translate-y-1/2 place-items-center rounded-full bg-white text-ink shadow-raised transition hover:scale-105 sm:grid',
        side === 'left' ? 'left-4' : 'right-4',
      )}
    >
      <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d={side === 'left' ? 'M15 18l-6-6 6-6' : 'M9 6l6 6-6 6'} />
      </svg>
    </button>
  );
}
