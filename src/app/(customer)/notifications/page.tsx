import type { Metadata } from 'next';
import { Inbox } from '@/components/notifications/inbox';

export const metadata: Metadata = { title: 'Notifications' };

export default function NotificationsPage() {
  return <Inbox />;
}
