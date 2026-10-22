import Image from 'next/image';
import { cx } from '@/lib/format';

// A business photo filling its (relatively positioned) box. https URLs go
// through Next's optimiser (next.config allows any https host); anything else
// (a local dev upload over http) is shown as-is, since the optimiser would
// refuse it. No photo: a soft brand-tinted placeholder with the initial.
export function Photo({
  src, alt, sizes, priority, className, name,
}: { src: string | null | undefined; alt: string; sizes: string; priority?: boolean; className?: string; name?: string }) {
  if (!src) {
    return (
      <div className={cx('absolute inset-0 grid place-items-center bg-gradient-to-br from-accent-soft to-accent/50', className)} aria-hidden>
        <span className="text-5xl font-bold tracking-tight text-brand/50">{(name ?? alt).trim()[0]?.toUpperCase() ?? ''}</span>
      </div>
    );
  }
  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      priority={priority}
      unoptimized={!src.startsWith('https://')}
      className={cx('object-cover', className)}
    />
  );
}
