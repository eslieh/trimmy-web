import { forwardRef, useId } from 'react';
import { cx } from '@/lib/format';

// Labelled form fields with the app's look: grey border, black on focus.
const control =
  'w-full rounded-xl border border-line-2 bg-white px-4 py-3 text-[15px] text-ink placeholder:text-ink-3 outline-none transition-colors focus:border-ink disabled:bg-surface-2 disabled:text-ink-3';

type FieldShell = { label?: string; hint?: string; error?: string; className?: string };

function Shell({ id, label, hint, error, className, children }: FieldShell & { id: string; children: React.ReactNode }) {
  return (
    <div className={cx('flex flex-col gap-1.5', className)}>
      {label ? (
        <label htmlFor={id} className="text-sm font-semibold text-ink">
          {label}
        </label>
      ) : null}
      {children}
      {error ? <p className="text-[13px] text-danger">{error}</p> : hint ? <p className="text-[13px] text-ink-2">{hint}</p> : null}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement> & FieldShell>(
  function Input({ label, hint, error, className, id, ...rest }, ref) {
    const auto = useId();
    const fid = id ?? auto;
    return (
      <Shell id={fid} label={label} hint={hint} error={error} className={className}>
        <input ref={ref} id={fid} className={cx(control, error && 'border-danger')} aria-invalid={!!error} {...rest} />
      </Shell>
    );
  },
);

export function Textarea({ label, hint, error, className, id, ...rest }: React.TextareaHTMLAttributes<HTMLTextAreaElement> & FieldShell) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <Shell id={fid} label={label} hint={hint} error={error} className={className}>
      <textarea id={fid} className={cx(control, 'min-h-24 resize-y')} {...rest} />
    </Shell>
  );
}

export function Select({
  label, hint, error, className, id, children, ...rest
}: React.SelectHTMLAttributes<HTMLSelectElement> & FieldShell) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <Shell id={fid} label={label} hint={hint} error={error} className={className}>
      <select id={fid} className={cx(control, 'appearance-none bg-[length:16px] pr-10')} {...rest}>
        {children}
      </select>
    </Shell>
  );
}

export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cx(
        'relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors disabled:opacity-40',
        checked ? 'bg-ink' : 'bg-line-2',
      )}
    >
      <span className={cx('inline-block size-5 rounded-full bg-white shadow transition-transform', checked ? 'translate-x-6' : 'translate-x-1')} />
    </button>
  );
}
