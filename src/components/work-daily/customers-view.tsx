'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Avatar, EmptyState, PageHeader } from '@/components/ui/misc';
import { useWork, workHref } from '@/components/work/context';
import { toQuery } from '@/lib/api';
import type { Customer } from '@/types/customer';
import type { CustomersPage } from '@/types/work-daily';
import { Loading, LoadError } from './bits';
import { formatPhone } from './phone';
import { instantDate } from './time';
import { useApi } from './use-api';

const PAGE = 50;

// Customers: the business's own address book (list-customers), A–Z,
// searched server-side by name, email or phone digits as you type.
export function CustomersView() {
  const router = useRouter();
  const { businessId } = useWork();
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [offset, setOffset] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => {
      // The list stores +2547…, so a typed leading 0 would never match.
      const q = query.trim();
      setDebounced(/^0\d{3,}/.test(q.replace(/\s/g, '')) ? q.replace(/\s/g, '').slice(1) : q);
      setOffset(0);
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  const { data, error, loading, reload } = useApi<CustomersPage>(`/businesses/${businessId}/customers${toQuery({ query: debounced, limit: PAGE, offset })}`);
  const open = (c: Customer) => router.push(workHref(businessId, `customers/${c.customerId}`));

  return (
    <div>
      <PageHeader title="Customers" subtitle={data ? `${data.total.toLocaleString('en-US')} in your list` : undefined} />

      <div className="mb-4 max-w-md">
        <label className="sr-only" htmlFor="customer-search">
          Search customers
        </label>
        <input
          id="customer-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, phone or email"
          className="h-11 w-full rounded-full border border-line-2 bg-white px-5 text-[15px] outline-none focus:border-ink"
        />
      </div>

      {error && !data ? (
        <LoadError error={error} onRetry={reload} title="Couldn't load customers" />
      ) : !data ? (
        <Loading />
      ) : data.customers.length === 0 ? (
        <EmptyState
          title={debounced ? 'No matches' : 'No customers yet'}
          body={debounced ? 'Try a different name, phone or email.' : 'Everyone you book with a phone number is added here automatically.'}
        />
      ) : (
        <>
          <div className="overflow-hidden rounded-card border border-line bg-white" aria-busy={loading}>
            <table className="w-full text-left text-sm">
              <thead className="hidden border-b border-line bg-surface-2 text-xs tracking-wide text-ink-2 uppercase md:table-header-group">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold">Name</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Phone</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Email</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">Visits</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Last booking</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {data.customers.map((c) => (
                  <tr
                    key={c.customerId}
                    tabIndex={0}
                    onClick={() => open(c)}
                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), open(c))}
                    className="cursor-pointer transition-colors hover:bg-surface-2 focus-visible:bg-surface-2"
                  >
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-3">
                        <Avatar name={c.name} src={c.avatarUrl} size={32} />
                        <span className="min-w-0">
                          <span className="block truncate font-semibold">{c.name}</span>
                          {/* Phones: contact under the name. */}
                          <span className="block truncate text-ink-2 md:hidden">
                            {formatPhone(c.phone) || c.email || 'No contact'} · {c.bookingsCount} visit{c.bookingsCount === 1 ? '' : 's'}
                          </span>
                        </span>
                      </span>
                    </td>
                    <td className="hidden px-4 py-3 whitespace-nowrap md:table-cell">{formatPhone(c.phone) || '—'}</td>
                    <td className="hidden max-w-[240px] truncate px-4 py-3 md:table-cell">{c.email || '—'}</td>
                    <td className="hidden px-4 py-3 text-right tabular-nums md:table-cell">{c.bookingsCount}</td>
                    <td className="hidden px-4 py-3 text-ink-2 md:table-cell">{c.lastBookingAt ? instantDate(c.lastBookingAt) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data.total > PAGE ? (
            <div className="mt-4 flex items-center justify-between gap-3 text-sm text-ink-2">
              <span>
                {offset + 1}–{Math.min(offset + PAGE, data.total)} of {data.total}
              </span>
              <span className="flex gap-2">
                <Button variant="secondary" size="sm" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE))}>
                  Previous
                </Button>
                <Button variant="secondary" size="sm" disabled={offset + PAGE >= data.total} onClick={() => setOffset(offset + PAGE)}>
                  Next
                </Button>
              </span>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
