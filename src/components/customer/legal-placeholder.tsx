import Link from 'next/link';

// Until the real documents are ready: say so plainly and give a contact.
// (No legal text is written here on purpose.)
export function LegalPlaceholder({ title, other }: { title: string; other: { href: string; label: string } }) {
  return (
    <article className="mx-auto max-w-2xl py-6">
      <p className="text-sm font-semibold uppercase tracking-wide text-brand">Legal</p>
      <h1 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">{title}</h1>
      <div className="mt-6 rounded-card border border-line bg-surface-2 p-6">
        <p className="text-lg font-bold">This document is being finalised</p>
        <p className="mt-2 text-ink-2">
          We&apos;re preparing Trimmy&apos;s {title.toLowerCase()} and will publish it here soon. If you have a question in the
          meantime, email us at{' '}
          <a href="mailto:support@trimmy.com" className="font-semibold text-ink underline">
            support@trimmy.com
          </a>
          .
        </p>
      </div>
      <p className="mt-6 text-sm text-ink-2">
        See also: <Link href={other.href} className="font-semibold underline">{other.label}</Link>
      </p>
    </article>
  );
}
