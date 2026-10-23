// Help: tickets with Trimmy's team (server: app/modules/support/router.py).

export type TicketCategory = 'booking' | 'payment' | 'refund' | 'account' | 'business' | 'bug' | 'other';
export type TicketStatus = 'new' | 'open' | 'waiting' | 'resolved' | 'closed';

export type TicketRow = {
  id: string;
  number: string;
  subject: string;
  category: TicketCategory;
  status: TicketStatus;
  bookingId: string | null;
  businessId: string | null;
  createdAt: string;
  lastMessageAt: string;
  preview: string;
  lastFrom: 'customer' | 'agent' | null;
};

export type TicketMessage = {
  id: string;
  kind: 'customer' | 'agent';
  authorName: string;
  body: string;
  attachmentUrl: string | null;
  createdAt: string;
};

export type Ticket = { ticket: TicketRow; bookingReference: string | null; businessName: string | null; messages: TicketMessage[] };

export const CATEGORY_LABEL: Record<TicketCategory, string> = {
  booking: 'A booking', payment: 'A payment', refund: 'A refund', account: 'My account',
  business: 'My business', bug: "Something isn't working", other: 'Something else',
};

export const STATUS_LABEL: Record<TicketStatus, string> = {
  new: 'Waiting for a reply', open: 'Waiting for a reply', waiting: 'Trimmy replied', resolved: 'Sorted', closed: 'Closed',
};
