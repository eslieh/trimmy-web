import { ButtonLink } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/misc';

export default function BusinessNotFound() {
  return (
    <EmptyState
      title="We couldn't find this business"
      body="It may have moved or stopped taking bookings on Trimmy."
      action={<ButtonLink href="/">Explore other places</ButtonLink>}
    />
  );
}
