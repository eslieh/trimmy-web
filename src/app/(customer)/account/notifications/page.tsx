import type { Metadata } from 'next';
import { NotificationPreferences } from '@/components/notifications/preferences';

export const metadata: Metadata = { title: 'Notification settings' };

export default function NotificationSettingsPage() {
  return <NotificationPreferences />;
}
