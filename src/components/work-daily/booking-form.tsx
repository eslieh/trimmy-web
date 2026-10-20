'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input, Select, Textarea } from '@/components/ui/field';
import { toast } from '@/components/ui/toast';
import { api, ApiError, errorMessage, toQuery } from '@/lib/api';
import { cx, dayLabel, money, timeLabel } from '@/lib/format';
import type { Booking } from '@/types/booking';
import type { Customer } from '@/types/customer';
import type { AppointmentPreset, Availability, CustomersPage, WorkBusiness } from '@/types/work-daily';
import { InlineError, Loading } from './bits';
import { formatPhone, normalizePhone, PHONE_HINT } from './phone';
import { durationLabel, isDateKey, isTime, toMinutes, weekdayOf } from './time';
import { useApi } from './use-api';
import { staffForServices } from './use-business';

// New appointment (POST /bookings/scheduled) and Walk-in (POST
// /bookings/walk-in), mirroring mobile's ScheduleAppointmentScreen and
// StartWalkInScreen: services, optional staff, the customer, and for a
// scheduled one a date and time. The server prices it and checks the person
// is free. Used in a modal on Today and as the /schedule and /walk-in pages.
export function BookingForm({
  mode, business, preset, today, onDone, onCancel,
}: {
  mode: 'scheduled' | 'walk_in';
  business: WorkBusiness;
  preset?: AppointmentPreset;
  today: string;
  onDone: (booking: Booking) => void;
  onCancel?: () => void;
}) {
  const [serviceIds, setServiceIds] = useState<string[]>([]);
  const [staffId, setStaffId] = useState<string>(preset?.staffId ?? '');
  const [name, setName] = useState(preset?.customerName ?? '');
  const [phone, setPhone] = useState(formatPhone(preset?.customerPhone));
  const [email, setEmail] = useState(preset?.customerEmail ?? '');
  const [notes, setNotes] = useState('');
  const [date, setDate] = useState(isDateKey(preset?.date) && preset.date >= today ? preset.date : today);
  const [time, setTime] = useState(isTime(preset?.time) ? preset.time : '');
  const [filter, setFilter] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [phoneError, setPhoneError] = useState('');

  const selected = business.services.filter((s) => serviceIds.includes(s.serviceId));
  const total = selected.reduce((sum, s) => sum + s.price.amount, 0);
  const duration = selected.reduce((sum, s) => sum + s.durationMinutes, 0);

  // Only people who do every chosen service; a preset person stays listed
  // (the server has the final say).
  const staffOptions = useMemo(() => {
    const able = staffForServices(business, serviceIds);
    const presetMember = business.staff.find((m) => m.staffId === preset?.staffId);
    return presetMember && !able.includes(presetMember) ? [...able, presetMember] : able;
  }, [business, serviceIds, preset?.staffId]);

  const groups = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const map = new Map<string, typeof business.services>();
    for (const s of business.services) {
      if (q && !s.name.toLowerCase().includes(q) && !s.categoryName.toLowerCase().includes(q)) continue;
      map.set(s.categoryName, [...(map.get(s.categoryName) ?? []), s]);
    }
    return [...map.entries()];
  }, [business, filter]);

  const hours = business.workingHours[weekdayOf(date)];
  const availabilityPath =
    mode === 'scheduled' && serviceIds.length && hours
      ? `/businesses/${business.businessId}/availability${toQuery({ date, serviceIds, staffId: staffId || undefined })}`
      : null;
  const availability = useApi<Availability>(availabilityPath);

  const toggle = (id: string) => setServiceIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setPhoneError('');
    const customerPhone = phone.trim() ? normalizePhone(phone) : null;
    if (phone.trim() && !customerPhone) return setPhoneError(`Enter a ${PHONE_HINT}.`);
    if (!selected.length) return setError('Choose at least one service.');
    if (mode === 'scheduled') {
      if (!name.trim()) return setError("Enter the customer's name.");
      if (!time) return setError('Choose a time.');
      if (hours && (toMinutes(time) < toMinutes(hours.open) || toMinutes(time) >= toMinutes(hours.close))) {
        return setError(`That's outside working hours (${timeLabel(hours.open)} – ${timeLabel(hours.close)}).`);
      }
    }
    const customerEmail = email.trim() || null;
    const customerName = name.trim();
    setSubmitting(true);
    try {
      // Bookings with a phone add the customer server-side; save someone
      // without one by hand, best-effort (never block the booking over it).
      if (!customerPhone && (customerName || customerEmail)) {
        await api(`/businesses/${business.businessId}/customers`, {
          method: 'POST',
          body: { name: customerName || 'Walk-in customer', phone: null, email: customerEmail },
        }).catch(() => {});
      }
      const body = {
        businessId: business.businessId,
        customerName,
        customerPhone,
        customerEmail,
        services: serviceIds.map((serviceId) => ({ serviceId, quantity: 1 })),
        staffId: staffId || null,
        notes: notes.trim() || null,
        ...(mode === 'scheduled' ? { date, time } : {}),
      };
      const booking = await api<Booking>(mode === 'scheduled' ? '/bookings/scheduled' : '/bookings/walk-in', { method: 'POST', body });
      toast.success({
        title: mode === 'scheduled' ? `Booked ${booking.customerName}, ${dayLabel(booking.date)} at ${timeLabel(booking.time)}` : `${booking.customerName} checked in`,
        body: booking.customerHasAccount ? 'Linked to their Trimmy account: they’ll see it in their app.' : undefined,
      });
      onDone(booking);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'invalid_phone') setPhoneError(err.message);
      else
        setError(
          err instanceof ApiError && err.code === 'slot_unavailable'
            ? `${staffOptions.find((m) => m.staffId === staffId)?.name ?? 'That time'} isn't free then. Pick another time or person.`
            : errorMessage(err, mode === 'scheduled' ? "Couldn't book the appointment." : "Couldn't start the walk-in."),
        );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-6" noValidate>
      <section className="flex flex-col gap-3" aria-labelledby="bf-services">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h3 id="bf-services" className="font-bold">Services</h3>
          {business.services.length > 8 ? (
            <input
              type="search"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter services"
              aria-label="Filter services"
              className="h-9 w-48 rounded-full border border-line-2 px-4 text-sm outline-none focus:border-ink"
            />
          ) : null}
        </div>
        {business.services.length === 0 ? (
          <p className="text-sm text-ink-2">This business has no services yet. The owner adds them in Settings.</p>
        ) : (
          <div className="max-h-72 overflow-y-auto rounded-xl border border-line">
            {groups.map(([category, services]) => (
              <fieldset key={category} className="border-b border-line last:border-b-0">
                <legend className="sr-only">{category}</legend>
                <p className="sticky top-0 bg-surface-2 px-4 py-1.5 text-xs font-semibold tracking-wide text-ink-2 uppercase">{category}</p>
                {services.map((s) => (
                  <label key={s.serviceId} className="flex cursor-pointer items-center gap-3 px-4 py-2.5 hover:bg-surface-2">
                    <input type="checkbox" checked={serviceIds.includes(s.serviceId)} onChange={() => toggle(s.serviceId)} className="size-4 accent-ink" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{s.name}</span>
                      <span className="text-sm text-ink-2">{durationLabel(s.durationMinutes)}</span>
                    </span>
                    <span className="text-sm font-semibold tabular-nums">{money(s.price)}</span>
                  </label>
                ))}
              </fieldset>
            ))}
          </div>
        )}
        {selected.length ? (
          <p className="text-sm text-ink-2">
            {selected.length} selected · {durationLabel(duration)} · <span className="font-semibold text-ink">{money(total)}</span>
          </p>
        ) : null}
      </section>

      <Select label="Staff" value={staffId} onChange={(e) => setStaffId(e.target.value)} hint={serviceIds.length ? 'Only people who do every chosen service.' : undefined}>
        <option value="">Any available (assign later)</option>
        {staffOptions.map((m) => (
          <option key={m.staffId} value={m.staffId}>
            {m.name}
          </option>
        ))}
      </Select>

      {mode === 'scheduled' ? (
        <section className="flex flex-col gap-3" aria-labelledby="bf-when">
          <h3 id="bf-when" className="font-bold">When</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input label="Date" type="date" min={today} value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
            <Input
              label="Time"
              type="time"
              step={300}
              value={time}
              onChange={(e) => setTime(e.target.value)}
              hint={hours ? `Open ${timeLabel(hours.open)} – ${timeLabel(hours.close)}. Any time works, on the grid or not.` : 'Closed that day.'}
            />
          </div>
          {availabilityPath ? (
            availability.loading && !availability.data ? (
              <Loading label="Finding open times…" className="py-4" />
            ) : availability.error ? (
              <p className="text-sm text-ink-2">Couldn&apos;t load open times. Type a time instead.</p>
            ) : availability.data && availability.data.slots.length ? (
              <div>
                <p className="mb-2 text-sm font-semibold text-ink-2">Open times{staffId ? '' : ' (anyone)'}</p>
                <div className="flex flex-wrap gap-2">
                  {availability.data.slots.map((slot) => (
                    <button
                      key={slot.time}
                      type="button"
                      onClick={() => setTime(slot.time)}
                      aria-pressed={time === slot.time}
                      className={cx(
                        'h-9 rounded-full border px-3 text-sm font-semibold tabular-nums transition-colors',
                        time === slot.time ? 'border-ink bg-ink text-white' : 'border-line-2 hover:border-ink',
                      )}
                    >
                      {timeLabel(slot.time)}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-ink-2">No open times left that day{staffId ? ' for this person' : ''}.</p>
            )
          ) : serviceIds.length === 0 && hours ? (
            <p className="text-sm text-ink-2">Choose services to see open times.</p>
          ) : null}
        </section>
      ) : null}

      <CustomerFields
        businessId={business.businessId}
        name={name}
        phone={phone}
        email={email}
        phoneError={phoneError}
        required={mode === 'scheduled'}
        onChange={(patch) => {
          if (patch.name !== undefined) setName(patch.name);
          if (patch.phone !== undefined) setPhone(patch.phone);
          if (patch.email !== undefined) setEmail(patch.email);
        }}
      />

      <Textarea label="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} className="[&_textarea]:min-h-16" />

      <InlineError>{error}</InlineError>
      <div className="flex flex-wrap justify-end gap-2">
        {onCancel ? (
          <Button type="button" variant="ghost" onClick={onCancel} disabled={submitting}>
            Cancel
          </Button>
        ) : null}
        <Button type="submit" loading={submitting} disabled={!selected.length}>
          {mode === 'scheduled' ? 'Book appointment' : 'Start walk-in'}
          {selected.length ? ` · ${money(total)}` : ''}
        </Button>
      </div>
    </form>
  );
}

// Name / phone / email, with matches from the customer list as you type.
function CustomerFields({
  businessId, name, phone, email, phoneError, required, onChange,
}: {
  businessId: string;
  name: string;
  phone: string;
  email: string;
  phoneError: string;
  required: boolean;
  onChange: (patch: { name?: string; phone?: string; email?: string }) => void;
}) {
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 250);
    return () => clearTimeout(t);
  }, [query]);
  const matches = useApi<CustomersPage>(
    debounced.length >= 2 ? `/businesses/${businessId}/customers${toQuery({ query: debounced, limit: 5 })}` : null,
  );
  const suggestions = !dismissed && debounced.length >= 2 ? (matches.data?.customers ?? []) : [];

  const pick = (c: Customer) => {
    onChange({ name: c.name, phone: formatPhone(c.phone), email: c.email ?? '' });
    setDismissed(true);
  };

  return (
    <section className="flex flex-col gap-3" aria-labelledby="bf-customer">
      <div>
        <h3 id="bf-customer" className="font-bold">Customer</h3>
        <p className="text-sm text-ink-2">Saved to your customer list. If the phone or email is on Trimmy, they&apos;ll see the booking in their app.</p>
      </div>
      <div className="relative">
        <Input
          label={required ? 'Name' : 'Name (optional)'}
          value={name}
          autoComplete="off"
          placeholder={required ? 'Jane Wanjiru' : 'Walk-in customer'}
          onChange={(e) => {
            onChange({ name: e.target.value });
            setQuery(e.target.value);
            setDismissed(false);
          }}
        />
        {suggestions.length ? (
          <ul role="listbox" aria-label="Existing customers" className="absolute inset-x-0 top-full z-10 mt-1 overflow-hidden rounded-xl border border-line bg-white shadow-raised">
            {suggestions.map((c) => (
              <li key={c.customerId}>
                <button type="button" onClick={() => pick(c)} className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left hover:bg-surface-2">
                  <span className="truncate font-semibold">{c.name}</span>
                  <span className="shrink-0 text-sm text-ink-2">{formatPhone(c.phone) || c.email}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          label="Phone (optional)"
          type="tel"
          inputMode="tel"
          autoComplete="off"
          placeholder="0712 345 678"
          value={phone}
          error={phoneError || undefined}
          hint={PHONE_HINT}
          onChange={(e) => {
            onChange({ phone: e.target.value });
            // The list searches phone digits as stored (+2547…), so drop a leading 0.
            const digits = e.target.value.replace(/\D/g, '').replace(/^0/, '');
            setQuery(digits.length >= 4 ? digits : '');
            setDismissed(false);
          }}
        />
        <Input label="Email (optional)" type="email" autoComplete="off" placeholder="jane@example.com" value={email} onChange={(e) => onChange({ email: e.target.value })} />
      </div>
    </section>
  );
}
