import { money } from '@/lib/format';
import type { Booking } from '@/types/booking';

function Row({ label, value, strong, tone }: { label: React.ReactNode; value: React.ReactNode; strong?: boolean; tone?: 'success' | 'danger' | 'muted' }) {
  const color = tone === 'success' ? 'text-success' : tone === 'danger' ? 'text-danger' : tone === 'muted' ? 'text-ink-2' : '';
  return (
    <div className={`flex justify-between gap-4 ${strong ? 'text-lg font-bold' : ''} ${color}`}>
      <dt>{label}</dt>
      <dd className="text-right font-semibold">{value}</dd>
    </div>
  );
}

// What was booked and every money line on it: services, total, the deposit
// (with its M-Pesa receipt and where it went), tip, and any cancellation fee,
// no-show fee or refund (BK-34 / BK-60 / BK-64).
export function BookingMoney({ booking }: { booking: Booking }) {
  const dp = booking.depositPayment;
  const depositPaid = booking.depositPaid ?? (dp?.status === 'succeeded' ? (dp.amount ?? booking.depositAmount) : null);
  return (
    <dl className="flex flex-col gap-2 text-[15px]">
      {booking.services.map((s, i) => (
        <Row
          key={`${s.serviceId}-${i}`}
          label={
            <>
              {s.quantity > 1 ? `${s.quantity} × ` : ''}
              {s.name}
            </>
          }
          value={money({ ...s.price, amount: s.price.amount * s.quantity })}
        />
      ))}
      <div className="my-1 border-t border-line" />
      <Row label="Total" value={money(booking.totalAmount)} strong />

      {booking.depositAmount ? (
        depositPaid ? (
          <Row label="Deposit paid" value={money(depositPaid)} tone="success" />
        ) : (
          <Row label={booking.status === 'cancelled' ? 'Deposit (not paid)' : 'Deposit due'} value={money(booking.depositAmount)} tone="muted" />
        )
      ) : null}
      {dp?.receipt ? (
        <p className="text-sm text-ink-2">
          M-Pesa receipt <span className="font-mono font-semibold text-ink">{dp.receipt}</span>
          {dp.paidAt ? ` · ${new Date(dp.paidAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Africa/Nairobi' })}` : ''}
          {dp.destination ? ` · paid to ${dp.destination.label}` : ''}
        </p>
      ) : null}
      {booking.tip && booking.tip.amount > 0 ? <Row label="Tip" value={money(booking.tip)} /> : null}
      {booking.paymentStatus === 'paid' && booking.paymentReference ? (
        <p className="text-sm text-ink-2">
          Paid in full · M-Pesa <span className="font-mono font-semibold text-ink">{booking.paymentReference}</span>
        </p>
      ) : booking.paymentStatus === 'paid' ? (
        <p className="text-sm text-ink-2">Paid in full{booking.paymentMethod === 'cash' ? ' (cash)' : ''}</p>
      ) : null}
      {booking.cancellationFee && booking.cancellationFee.amount > 0 ? (
        <Row label="Late cancellation fee (kept from deposit)" value={money(booking.cancellationFee)} tone="danger" />
      ) : null}
      {booking.noShowFee ? (
        <>
          <Row
            label={`No-show fee (${booking.noShowFee.percent}% of total)`}
            value={money(booking.noShowFee.fee)}
            tone="danger"
          />
          {booking.noShowFee.kept.amount > 0 ? <p className="text-sm text-ink-2">{money(booking.noShowFee.kept)} was kept from your deposit.</p> : null}
        </>
      ) : null}
      {booking.refund ? (
        <Row
          label={booking.refund.status === 'due' ? 'Refund owed to you' : 'Refunded'}
          value={
            <>
              {money(booking.refund.amount)}
              {booking.refund.reference ? <span className="block text-xs font-normal text-ink-2">Ref {booking.refund.reference}</span> : null}
            </>
          }
          tone="success"
        />
      ) : null}
      {booking.refund?.status === 'due' ? (
        <p className="text-sm text-ink-2">Deposits go straight to the business, so {booking.businessName} sends refunds back to you directly.</p>
      ) : null}
    </dl>
  );
}
