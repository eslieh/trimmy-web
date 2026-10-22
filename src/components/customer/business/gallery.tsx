'use client';

import { useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { cx } from '@/lib/format';
import { Photo } from '../photo';

// Airbnb-style: one large photo and up to four small ones on desktop, a
// swipeable strip on phones, and every photo in a dialog.
export function Gallery({ name, photos }: { name: string; photos: string[] }) {
  const [open, setOpen] = useState(false);
  if (!photos.length) {
    return (
      <div className="relative aspect-[16/7] overflow-hidden rounded-[2rem] bg-surface-3">
        <Photo src={null} alt={name} sizes="100vw" />
      </div>
    );
  }
  const grid = photos.slice(0, 5);
  return (
    <>
      {/* Phones: horizontal scroll-snap strip. */}
      <div className="-mx-4 flex snap-x snap-mandatory gap-2 overflow-x-auto px-4 sm:hidden [scrollbar-width:none]">
        {photos.map((src, i) => (
          <button
            key={src + i}
            type="button"
            onClick={() => setOpen(true)}
            className="relative aspect-[4/3] w-[88%] shrink-0 snap-center overflow-hidden rounded-3xl bg-surface-3"
            aria-label={`Photo ${i + 1} of ${photos.length}: open all photos`}
          >
            <Photo src={src} alt={`${name}, photo ${i + 1}`} sizes="90vw" priority={i === 0} />
          </button>
        ))}
      </div>

      {/* Tablet and up: the mosaic. */}
      <div className={cx('relative hidden gap-2 overflow-hidden rounded-[2rem] sm:grid', grid.length >= 3 ? 'aspect-[16/7] grid-cols-4 grid-rows-2' : 'aspect-[16/7] grid-cols-2')}>
        {grid.map((src, i) => (
          <button
            key={src + i}
            type="button"
            onClick={() => setOpen(true)}
            className={cx('relative overflow-hidden bg-surface-3 hover:opacity-95', grid.length >= 3 && i === 0 && 'col-span-2 row-span-2', grid.length === 3 && i > 0 && 'col-span-2')}
            aria-label={`Open photo ${i + 1} of ${photos.length}`}
          >
            <Photo src={src} alt={`${name}, photo ${i + 1}`} sizes={i === 0 ? '50vw' : '25vw'} priority={i === 0} />
          </button>
        ))}
        {photos.length > 1 ? (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="absolute right-4 bottom-4 rounded-full bg-white px-4 py-2 text-sm font-semibold shadow-card transition-transform hover:scale-[1.03]"
          >
            Show all {photos.length} photos
          </button>
        ) : null}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={`${name}: photos`} wide>
        <div className="flex flex-col gap-3 pb-4">
          {photos.map((src, i) => (
            <div key={src + i} className="relative aspect-[4/3] overflow-hidden rounded-3xl bg-surface-3">
              <Photo src={src} alt={`${name}, photo ${i + 1}`} sizes="(min-width: 640px) 640px, 100vw" />
            </div>
          ))}
        </div>
      </Modal>
    </>
  );
}
