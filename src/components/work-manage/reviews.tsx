'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/field';
import { EmptyState, PageHeader, Tabs } from '@/components/ui/misc';
import { toast } from '@/components/ui/toast';
import { useWork } from '@/components/work/context';
import { Stars } from '@/components/customer/icons';
import { ReviewCard } from '@/components/customer/reviews/review-card';
import { api, errorMessage } from '@/lib/api';
import type { BusinessProfileReview, ReviewPage } from '@/types/discovery';
import { ErrorBlock, Loading } from './shared';
import { useApi } from './use-api';

type Filter = 'unreplied' | 'all';
const PAGE = 20;

// The business's reviews (owner and front desk): newest first, "Needs a reply"
// by default, with an inline reply that shows publicly under the review. The
// customer is notified of a new reply.
export function ReviewsView() {
  const { businessId } = useWork();
  const [filter, setFilter] = useState<Filter>('unreplied');
  const [limit, setLimit] = useState(PAGE);
  const path = `/businesses/${businessId}/reviews?limit=${limit}${filter === 'unreplied' ? '&unreplied=true' : ''}`;
  const { data, error, loading, reload, mutate } = useApi<ReviewPage>(path);
  const all = useApi<ReviewPage>(`/businesses/${businessId}/reviews?limit=1`);

  const replace = (updated: BusinessProfileReview) => {
    mutate((d) => ({
      ...d,
      // Answered: it leaves the "Needs a reply" list.
      reviews:
        filter === 'unreplied' && updated.reply
          ? d.reviews.filter((r) => r.reviewId !== updated.reviewId)
          : d.reviews.map((r) => (r.reviewId === updated.reviewId ? updated : r)),
      total: filter === 'unreplied' && updated.reply ? d.total - 1 : d.total,
    }));
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Reviews"
        subtitle="What customers say after a visit. Replies show under the review on your page."
        actions={
          all.data?.total ? (
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold text-brand">{all.data.averageRating.toFixed(1)}</span>
              <Stars rating={all.data.averageRating} />
              <span className="text-sm text-ink-2">{all.data.total} total</span>
            </div>
          ) : null
        }
      />
      <Tabs
        value={filter}
        onChange={(f) => {
          setFilter(f);
          setLimit(PAGE);
        }}
        options={[
          { key: 'unreplied', label: 'Needs a reply', badge: filter === 'unreplied' ? data?.total || undefined : undefined },
          { key: 'all', label: 'All reviews' },
        ]}
      />
      {error && !data ? (
        <ErrorBlock message={error} onRetry={reload} />
      ) : !data ? (
        <Loading label="Loading reviews…" />
      ) : data.reviews.length === 0 ? (
        <EmptyState
          title={filter === 'unreplied' ? 'All caught up' : 'No reviews yet'}
          body={filter === 'unreplied' ? 'Every review has a reply.' : 'Customers can review a visit once it is completed.'}
        />
      ) : (
        <>
          <ul className="grid grid-cols-1 gap-3 xl:grid-cols-2">
            {data.reviews.map((r) => (
              <li key={r.reviewId}>
                <ReviewWithReply review={r} onChange={replace} />
              </li>
            ))}
          </ul>
          {data.total > data.reviews.length ? (
            <Button variant="secondary" className="self-center" loading={loading} onClick={() => setLimit((l) => l + PAGE)}>
              Show more
            </Button>
          ) : null}
        </>
      )}
    </div>
  );
}

function ReviewWithReply({ review, onChange }: { review: BusinessProfileReview; onChange: (r: BusinessProfileReview) => void }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(review.reply?.text ?? '');
  const [saving, setSaving] = useState(false);

  const save = async (remove = false) => {
    setSaving(true);
    try {
      const updated = await api<BusinessProfileReview>(`/reviews/${review.reviewId}/reply`, remove
        ? { method: 'DELETE' }
        : { method: 'PUT', body: { text: text.trim() } });
      onChange(updated);
      setEditing(false);
      toast.success(remove ? 'Reply removed' : 'Reply posted');
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't save the reply."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex h-full flex-col gap-3">
      <ReviewCard
        review={editing ? { ...review, reply: null } : review}
        action={
          !editing ? (
            <Button size="sm" variant={review.reply ? 'ghost' : 'secondary'} onClick={() => setEditing(true)}>
              {review.reply ? 'Edit reply' : 'Reply'}
            </Button>
          ) : null
        }
      />
      {editing ? (
        <div className="flex flex-col gap-2 rounded-3xl bg-white p-4 ring-1 ring-ink/5">
          <Textarea
            label="Your reply"
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={1000}
            placeholder="Thanks for coming in! …"
            hint="Shown publicly under the review."
          />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => save()} loading={saving} disabled={!text.trim()}>
              {review.reply ? 'Save reply' : 'Post reply'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)} disabled={saving}>Cancel</Button>
            {review.reply ? (
              <Button size="sm" variant="danger" className="ml-auto" onClick={() => save(true)} disabled={saving}>Remove reply</Button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
