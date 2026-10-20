// One entry in the in-app inbox (reference/api/auth.json#list-notifications).
// `type` and `data` are the same as the matching push's, so a tapped inbox
// row and a tapped push open the same screen (utils/pushNotifications).
export type AppNotification = {
  notificationId: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  createdAt: string;
  readAt: string | null;
};

export type NotificationPage = {
  notifications: AppNotification[];
  unreadCount: number;
  // Pass back as ?cursor= for the next (older) page; null on the last page.
  nextCursor: string | null;
};
