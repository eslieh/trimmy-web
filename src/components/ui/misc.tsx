import Link from 'next/link';
import Image from 'next/image';
import { cx } from '@/lib/format';

// White, borderless, softly lifted: the landing's floating-card look.
export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cx('rounded-card bg-white p-5 shadow-card ring-1 ring-ink/5', className)}>{children}</div>;
}

// The landing's tinted tile: an icon in a white square, a capitals title, a line of copy.
export function FeatureTile({ icon, title, body, className }: { icon: React.ReactNode; title: string; body?: string; className?: string }) {
  return (
    <div className={cx('rounded-2xl bg-ink/[0.03] p-6 transition-colors hover:bg-accent-soft/60', className)}>
      <div className="grid size-12 place-items-center rounded-xl bg-white text-ink shadow-sm">{icon}</div>
      <p className="mt-5 text-sm font-semibold tracking-wide uppercase">{title}</p>
      {body ? <p className="mt-2 text-sm leading-6 text-ink-2">{body}</p> : null}
    </div>
  );
}

// The landing's section label: a pink dot and a capitalised word.
export function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cx('flex items-center gap-2 text-sm font-semibold tracking-wide uppercase', className)}>
      <span className="size-1.5 rounded-full bg-brand-pink" aria-hidden />
      {children}
    </span>
  );
}

export function Badge({ tone = 'neutral', children }: { tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'brand'; children: React.ReactNode }) {
  const tones = {
    neutral: 'bg-ink/[0.05] text-ink',
    success: 'bg-success/10 text-success',
    warning: 'bg-warning/10 text-warning',
    danger: 'bg-danger/10 text-danger',
    brand: 'bg-accent-soft text-accent-foreground',
  };
  return <span className={cx('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold', tones[tone])}>{children}</span>;
}

export function EmptyState({ title, body, action }: { title: string; body?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl bg-ink/[0.03] px-6 py-14 text-center">
      <p className="text-lg font-bold tracking-tight">{title}</p>
      {body ? <p className="max-w-sm text-ink-2">{body}</p> : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}

export function PageHeader({ title, subtitle, eyebrow, actions }: { title: string; subtitle?: string; eyebrow?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow ? <Eyebrow className="mb-3">{eyebrow}</Eyebrow> : null}
        <h1 className="text-3xl leading-tight font-bold tracking-tight sm:text-4xl">{title}</h1>
        {subtitle ? <p className="mt-2 text-ink-2">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

const AVATAR_COLORS = ['#b83a6e', '#153f63', '#0a8a4b', '#b45309', '#5a62c4', '#0f766e'];
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

// The landing's mark: a pink "T" in a rounded tile, then "rimmy". Pure CSS,
// so no image to download. `light` is for use on photos.
export function Logo({ height = 28, href = '/', light }: { height?: number; href?: string | null; light?: boolean }) {
  const mark = (
    <span className="flex items-center gap-[0.25em]" style={{ fontSize: height * 0.64 }} aria-label="Trimmy">
      <span
        className={cx('grid place-items-center rounded-[0.4em] font-bold text-accent', light ? 'bg-white/15' : 'bg-ink')}
        style={{ width: height, height }}
        aria-hidden
      >
        T
      </span>
      <span className={cx('font-semibold tracking-tight', light ? 'text-white' : 'text-ink')} aria-hidden>
        rimmy
      </span>
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
            o.key === value ? 'bg-ink text-white' : 'bg-ink/[0.04] text-ink hover:bg-accent-soft',
          )}
        >
          {o.label}
          {o.badge ? <span className="ml-1.5 opacity-70">{o.badge}</span> : null}
        </button>
      ))}
    </div>
  );
}
