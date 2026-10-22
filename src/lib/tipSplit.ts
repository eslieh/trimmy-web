// Splitting one tip between the people in a visit, the way the customer wants. Whole shillings,
// and the shares always add up to the total. The mobile app has the same rules
// (mobile src/utils/tipSplit.ts): keep the two in step.

export type TipMode = 'even' | 'value' | 'custom';

// One person in the visit: what their services come to, and when they started (who's first).
export type TipPerson = { staffId: string; value: number };

// `people` in visit order. Leftover shillings go one each to the first people (even), or to the
// biggest remainders (by value). Custom amounts are the caller's and aren't touched here.
export function splitTip(total: number, people: TipPerson[], mode: Exclude<TipMode, 'custom'>): Record<string, number> {
  const out: Record<string, number> = {};
  if (!people.length || total <= 0) {
    for (const p of people) out[p.staffId] = 0;
    return out;
  }
  const value = people.reduce((sum, p) => sum + Math.max(p.value, 0), 0);
  if (mode === 'even' || value <= 0) {
    const base = Math.floor(total / people.length);
    let left = total - base * people.length;
    for (const p of people) {
      out[p.staffId] = base + (left > 0 ? 1 : 0);
      left -= 1;
    }
    return out;
  }
  const exact = people.map((p, i) => ({ id: p.staffId, i, raw: (total * Math.max(p.value, 0)) / value }));
  for (const e of exact) out[e.id] = Math.floor(e.raw);
  let left = total - exact.reduce((sum, e) => sum + out[e.id], 0);
  for (const e of [...exact].sort((a, b) => b.raw - Math.floor(b.raw) - (a.raw - Math.floor(a.raw)) || a.i - b.i)) {
    if (left <= 0) break;
    out[e.id] += 1;
    left -= 1;
  }
  return out;
}
