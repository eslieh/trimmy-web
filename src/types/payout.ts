export type PayoutStatus = 'pending' | 'paid' | 'rejected';

// A staff member's withdrawal request from their earnings wallet (S3/O4).
// Trimmy never moves this money: "approve" records that the owner paid the
// staff member themselves. Keyed by staffId (BK-02), not invitationId.
export type PayoutRequest = {
  payoutId: string;
  businessId: string;
  staffId: string | null;
  staffName: string;
  amount: number;
  currency: 'KES';
  status: PayoutStatus;
  requestedAt: string;
  respondedAt: string | null; // when the owner approved/rejected
  rejectionReason: string | null;
};

// The money parts of a staff wallet. earned = commission on paid bookings
// (fixed on each booking when it's paid, at that moment's commissionPercent);
// tips / bonuses add, deductions / advances take away (owner adjustments).
// available = earned + tips + bonuses − deductions − advances − pending − paid,
// and can be negative after a deduction or advance (payouts are refused
// until it's back above 0).
export type WalletTotals = {
  currency: 'KES';
  earned: number;
  tips: number;
  bonuses: number;
  deductions: number;
  advances: number;
  pending: number;
  paid: number;
  available: number;
};

// GET /me/payouts/balance or /businesses/{id}/staff/{staffId}/payout-balance.
export type PayoutBalance = WalletTotals & {
  businessId: string;
  staffId: string;
  commissionPercent: number | null;
};

// GET /me/wallet — one wallet across every business they work at, with a
// row per business (payouts are still requested per business).
export type Wallet = WalletTotals & {
  businesses: (PayoutBalance & { businessName: string; role: string })[];
};

export type WalletEntryType = 'commission' | 'tip' | 'bonus' | 'deduction' | 'advance' | 'payout';

// One statement line, newest first. amount is the signed effect on the
// balance; balanceAfter the balance right after it. A payout counts while
// pending or paid and is 0 once rejected (payoutAmount = what was asked).
export type WalletEntry = {
  entryId: string;
  type: WalletEntryType;
  at: string;
  amount: number;
  balanceAfter: number;
  businessId: string;
  businessName: string;
  description: string;
  bookingId: string | null;
  bookingReference: string | null;
  payoutId: string | null;
  payoutStatus: PayoutStatus | null;
  payoutAmount: number | null;
  adjustmentId: string | null;
  note: string | null;
};

export type WalletStatement = {
  currency: 'KES';
  balance: number;
  total: number;
  nextOffset: number | null;
  entries: WalletEntry[];
};

export type AdjustmentKind = 'tip' | 'bonus' | 'deduction' | 'advance';

export type WalletAdjustment = {
  adjustmentId: string;
  businessId: string;
  staffId: string | null;
  staffName: string;
  kind: AdjustmentKind;
  amount: number;
  signedAmount: number;
  currency: 'KES';
  note: string | null;
  bookingId: string | null;
  createdAt: string;
  voidedAt: string | null;
};
