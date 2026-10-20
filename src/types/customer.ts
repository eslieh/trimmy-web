// A business's own lightweight address book — distinct from the app's
// customer *user* accounts (there's no login/identity link here). First
// created by the "New appointment" flow (Today tab) so a phone/email typed
// once can be recognized and reused next time.
export type Customer = {
  customerId: string;
  businessId: string;
  name: string;
  phone: string | null;
  email: string | null; // phone is E.164 from the server
  createdAt: string;
  bookingsCount: number; // bookings with this phone, cancelled ones excluded
  lastBookingAt: string | null;
};
