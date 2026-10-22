import Link from 'next/link';
import { cx } from '@/lib/format';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'brand' | 'glass';
type Size = 'sm' | 'md' | 'lg';

// The landing's pill buttons: brand is the pink call to action, glass sits on
// photos (no backdrop blur: it's costly on low-end phones).
const VARIANTS: Record<Variant, string> = {
  primary: 'bg-ink text-white hover:bg-black disabled:bg-surface-3 disabled:text-ink-3',
  brand: 'bg-accent text-accent-foreground hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100',
  secondary: 'bg-white text-ink border border-line-2 hover:border-ink disabled:text-ink-3 disabled:border-line',
  ghost: 'bg-transparent text-ink hover:bg-ink/[0.04] disabled:text-ink-3',
  danger: 'bg-white text-danger border border-line-2 hover:border-danger disabled:text-ink-3',
  glass: 'border border-white/30 bg-white/10 text-white hover:bg-white/20',
};
const SIZES: Record<Size, string> = {
  sm: 'h-9 px-4 text-sm',
  md: 'h-11 px-5 text-[15px]',
  lg: 'h-13 px-6 text-base',
};
// With the arrow, the right padding shrinks so the circle sits in the pill's end.
const ARROW_PAD: Record<Size, string> = { sm: 'pr-1', md: 'pr-1.5', lg: 'pr-2' };
const ARROW_SIZE: Record<Size, string> = { sm: 'size-7', md: 'size-8', lg: 'size-9' };

export function buttonClass(variant: Variant = 'primary', size: Size = 'md', className?: string, arrow?: boolean) {
  return cx(
    'inline-flex items-center justify-center gap-2 rounded-full font-semibold tracking-wide transition disabled:cursor-not-allowed whitespace-nowrap',
    VARIANTS[variant],
    SIZES[size],
    arrow && cx('gap-3', ARROW_PAD[size]),
    className,
  );
}

// The ink circle with a ↗ that ends the landing's call-to-action pills.
export function ButtonArrow({ size = 'md' }: { size?: Size }) {
  return (
    <span className={cx('grid shrink-0 place-items-center rounded-full bg-ink text-white', ARROW_SIZE[size])} aria-hidden>
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="size-3.5">
        <path d="M5 15l10-10M7 5h8v8" />
      </svg>
    </span>
  );
}

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size; loading?: boolean; arrow?: boolean };

export function Button({ variant, size, loading, arrow, className, children, disabled, ...rest }: ButtonProps) {
  return (
    <button className={buttonClass(variant, size, className, arrow)} disabled={disabled || loading} {...rest}>
      {loading ? <Spinner className="size-4" /> : null}
      {children}
      {arrow ? <ButtonArrow size={size} /> : null}
    </button>
  );
}

export function ButtonLink({
  href, variant, size, arrow, className, children,
}: { href: string; variant?: Variant; size?: Size; arrow?: boolean; className?: string; children: React.ReactNode }) {
  return (
    <Link href={href} className={buttonClass(variant, size, className, arrow)}>
      {children}
      {arrow ? <ButtonArrow size={size} /> : null}
    </Link>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={cx('inline-block animate-spin rounded-full border-2 border-current border-r-transparent', className ?? 'size-5')}
    />
  );
}
