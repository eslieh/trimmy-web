// Explore's search, as it lives in the URL (shared by the server page and
// the client search controls).
export type ExploreQuery = {
  q?: string;
  category?: string;
  priceMax?: number;
  ratingMin?: number;
  radiusKm?: number;
  lat?: number;
  lng?: number;
};

export function exploreHref(query: ExploreQuery): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== '') p.set(k, String(v));
  const s = p.toString();
  return s ? `/?${s}` : '/';
}
