// Curated point-balance bands for the programmatic "where can I go with N
// points" SEO tree (app/points/[amount]). These are NOT user input — they're
// a small, fixed, exported list that drives generateStaticParams so every
// page in the tree is prerendered at build time. Chosen to span a typical
// member's range: a modest sign-up-bonus balance (25k) up through a
// long-haul-premium-cabin balance (500k).
//
// Pure, side-effect-free helpers only — no I/O, nothing LLM-generated. See
// lib/__tests__/points-bands.test.ts.

export const POINTS_BANDS: number[] = [
  25000, 50000, 75000, 100000, 150000, 200000, 300000, 500000,
]

// True only for one of the curated bands above.
export function isPointsBand(amount: number): boolean {
  return POINTS_BANDS.includes(amount)
}

// The URL segment for a band, e.g. 100000 -> "100000". Single source of
// truth so generateStaticParams, internal links, and tests can't drift.
export function pointsBandSlug(amount: number): string {
  return String(amount)
}

// Parse a route param back to a curated band. Deliberately strict — matches
// the slug against POINTS_BANDS' own string form rather than coercing with
// Number(), so lookalikes ("0100000", "1e5", "100,000") are rejected rather
// than silently normalized. Returns undefined for anything that isn't
// exactly one of the curated bands, so the caller can notFound().
export function parsePointsBand(slug: string): number | undefined {
  return POINTS_BANDS.find((band) => pointsBandSlug(band) === slug)
}

// Full figure with thousands separators: 100000 -> "100,000".
export function formatPointsLabel(amount: number): string {
  return amount.toLocaleString('en-US')
}

// Compact figure for headlines/chips: 100000 -> "100K", 25000 -> "25K".
// Mirrors the compactMiles convention used on DealCard.
export function formatPointsCompact(amount: number): string {
  const k = amount / 1000
  return `${Number.isInteger(k) ? k : k.toFixed(1)}K`
}

// The band immediately below/above a given band, for "have fewer/more
// points?" internal linking. Both are undefined at the ends of the range;
// undefined (not a boundary value) when `amount` isn't itself a curated band.
export function neighborBands(amount: number): { prev?: number; next?: number } {
  const idx = POINTS_BANDS.indexOf(amount)
  if (idx === -1) return {}
  return { prev: POINTS_BANDS[idx - 1], next: POINTS_BANDS[idx + 1] }
}
