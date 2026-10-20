// Kenyan phone numbers, as the mobile app normalises them (utils/phone.ts):
// whatever was typed (0712 345 678, 712345678, 254712345678, +254 712…)
// becomes E.164 (+254712345678). Numbers in another country's format must
// be typed with their + code.

export function normalizePhone(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const digits = trimmed.replace(/\D/g, '');
  if (trimmed.startsWith('+')) return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
  if (digits.startsWith('254') && digits.length === 12) return `+${digits}`;
  if (digits.startsWith('0') && digits.length === 10) return `+254${digits.slice(1)}`;
  if (/^[17]\d{8}$/.test(digits)) return `+254${digits}`;
  return null;
}

// '+254712345678' → '0712 345 678'; anything else is shown as stored.
export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return '';
  const m = /^\+254(\d{3})(\d{3})(\d{3})$/.exec(phone);
  return m ? `0${m[1]} ${m[2]} ${m[3]}` : phone;
}

export const PHONE_HINT = 'Kenyan mobile, e.g. 0712 345 678';
