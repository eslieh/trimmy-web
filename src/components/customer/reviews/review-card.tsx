import { Avatar } from '@/components/ui/misc';
import { relativeTime } from '@/lib/format';
import type { BusinessProfileReview } from '@/types/discovery';
import { Stars } from '../icons';

// One review: who wrote it (photo, name, when), the stars, what was done and by
// whom, the text, and the business's reply under it. `showBusiness` names the
// business (a customer's own reviews list); `action` is a slot for the
// business side (Reply / Edit).
export function ReviewCard({
  review, showBusiness, action,
}: { review: BusinessProfileReview; showBusiness?: boolean; action?: React.ReactNode }) {
  const what = [review.services?.length ? review.services.join(', ') : null, review.staffName ? `with ${review.staffName}` : null]
    .filter(Boolean)
    .join(' · ');
  return (
    <article className="flex h-full flex-col rounded-3xl bg-ink/[0.03] p-5">
      <div className="flex items-center gap-3">
        <Avatar name={review.authorName} src={review.authorAvatarUrl} size={40} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{review.authorName}</p>
          <p className="text-sm text-ink-2">
            {showBusiness && review.businessName ? `${review.businessName} · ` : ''}
            {relativeTime(review.createdAt)}
          </p>
        </div>
        {action}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
        <Stars rating={review.rating} className="size-3.5" />
        {what ? <span className="text-sm text-ink-2">{what}</span> : null}
      </div>
      {review.text ? <p className="mt-2 leading-relaxed">{review.text}</p> : null}
      {review.reply ? (
        <div className="mt-4 rounded-2xl bg-white p-4 ring-1 ring-ink/5">
          <p className="text-xs font-semibold tracking-wide text-ink-2 uppercase">
            Reply from {showBusiness && review.businessName ? review.businessName : 'the business'} · {relativeTime(review.reply.repliedAt)}
          </p>
          <p className="mt-1 text-[15px] leading-relaxed">{review.reply.text}</p>
        </div>
      ) : null}
    </article>
  );
}
