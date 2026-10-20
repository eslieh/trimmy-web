import Image from 'next/image';
import Link from 'next/link';
import { cx } from '@/lib/format';

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cx('rounded-card border border-line bg-white p-5 shadow-card', className)}>{children}</div>;
}

export function Badge({ tone = 'neutral', children }: { tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'brand'; children: React.ReactNode }) {
  const tones = {
    neutral: 'bg-surface-3 text-ink',
    success: 'bg-success/10 text-success',
    warning: 'bg-warning/10 text-warning',
    danger: 'bg-danger/10 text-danger',
    brand: 'bg-brand/10 text-brand',
  };
  return <span className={cx('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold', tones[tone])}>{children}</span>;
}

export function EmptyState({ title, body, action }: { title: string; body?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-card border border-dashed border-line-2 px-6 py-14 text-center">
      <p className="text-lg font-bold">{title}</p>
      {body ? <p className="max-w-sm text-ink-2">{body}</p> : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{title}</h1>
        {subtitle ? <p className="mt-1 text-ink-2">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

const AVATAR_COLORS = ['#771ee2', '#e03ab3', '#0a8a4b', '#b45309', '#2563eb', '#0f766e'];
export function Avatar({ name, src, size = 40 }: { name: string; src?: string | null; size?: number }) {
  if (src) {
    return <Image src={src} alt={name} width={size} height={size} className="rounded-full object-cover" style={{ width: size, height: size }} unoptimized />;
  }
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('') || '?';
  const color = AVATAR_COLORS[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_COLORS.length];
  return (
    <span
      className="inline-grid shrink-0 place-items-center rounded-full font-bold text-white"
      style={{ width: size, height: size, background: color, fontSize: size * 0.38 }}
      aria-hidden
    >
      {initials}
    </span>
  );
}

// The Trimmy wordmark (the same artwork as the app's splash), cropped to the letters.
export function Logo({ height = 28, href = '/' }: { height?: number; href?: string | null }) {
  const scale = height / 135; // the letters span ~135 of the 1024px artwork's height
  const mark = (
    <span className="relative block overflow-hidden" style={{ height, width: 430 * scale }} aria-label="Trimmy">
      <Image
        src="/wordmark.png"
        alt="Trimmy"
        width={1024}
        height={1024}
        priority
        style={{ position: 'absolute', width: 1024 * scale, height: 1024 * scale, maxWidth: 'none', left: -296 * scale, top: -445 * scale }}
      />
    </span>
  );
  return href ? <Link href={href} className="shrink-0">{mark}</Link> : mark;
}

export function Tabs<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { key: T; label: string; badge?: number }[] }) {
  return (
    <div role="tablist" className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.key}
          role="tab"
          aria-selected={o.key === value}
          onClick={() => onChange(o.key)}
          className={cx(
            'rounded-full px-4 py-2 text-sm font-semibold transition-colors',
            o.key === value ? 'bg-ink text-white' : 'bg-surface-3 text-ink hover:bg-line',
          )}
        >
          {o.label}
          {o.badge ? <span className="ml-1.5 opacity-70">{o.badge}</span> : null}
        </button>
      ))}
    </div>
  );
}
