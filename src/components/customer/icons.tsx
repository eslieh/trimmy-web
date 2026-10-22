// Small inline icons (no icon library in this app). Decorative: the control
// around each one carries the accessible name.
type P = { className?: string };
const base = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

export function StarIcon({ className = 'size-4' }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6L2.5 9.4l6.6-.8L12 2.5z" />
    </svg>
  );
}

export function HeartIcon({ className = 'size-5', filled }: P & { filled?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base} fill={filled ? 'currentColor' : 'none'} aria-hidden>
      <path d="M12 20.5s-7.5-4.6-9.2-9.4C1.7 7.8 3.9 4.5 7.3 4.5c2 0 3.6 1.1 4.7 2.7 1.1-1.6 2.7-2.7 4.7-2.7 3.4 0 5.6 3.3 4.5 6.6-1.7 4.8-9.2 9.4-9.2 9.4z" />
    </svg>
  );
}

export function SearchIcon({ className = 'size-5' }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base} aria-hidden>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </svg>
  );
}

export function SlidersIcon({ className = 'size-4' }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base} aria-hidden>
      <path d="M4 6h10M18 6h2M4 18h4M12 18h8M4 12h2M10 12h10" />
      <circle cx="16" cy="6" r="2" />
      <circle cx="10" cy="18" r="2" />
      <circle cx="8" cy="12" r="2" />
    </svg>
  );
}

export function PinIcon({ className = 'size-4' }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base} aria-hidden>
      <path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z" />
      <circle cx="12" cy="9.5" r="2.5" />
    </svg>
  );
}

export function LocateIcon({ className = 'size-4' }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base} aria-hidden>
      <circle cx="12" cy="12" r="7" />
      <circle cx="12" cy="12" r="2" fill="currentColor" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
    </svg>
  );
}

export function CheckIcon({ className = 'size-4' }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base} strokeWidth={2.5} aria-hidden>
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}

export function ClockIcon({ className = 'size-4' }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base} aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

export function ChevronLeftIcon({ className = 'size-5' }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base} aria-hidden>
      <path d="M15 5l-7 7 7 7" />
    </svg>
  );
}

export function ChevronRightIcon({ className = 'size-5' }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base} aria-hidden>
      <path d="M9 5l7 7-7 7" />
    </svg>
  );
}

export function PhoneIcon({ className = 'size-4' }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base} aria-hidden>
      <rect x="6" y="2.5" width="12" height="19" rx="2.5" />
      <path d="M11 18h2" />
    </svg>
  );
}

export function Stars({ rating, className = 'size-4' }: { rating: number; className?: string }) {
  return (
    <span className="inline-flex text-brand-pink" aria-label={`${rating} out of 5 stars`} role="img">
      {[1, 2, 3, 4, 5].map((i) => (
        <StarIcon key={i} className={`${className} ${i <= Math.round(rating) ? '' : 'text-line-2'}`} />
      ))}
    </span>
  );
}
