// Award sweet-spots seed dataset — the §2 reference table from
// docs/content-plan.md transcribed into typed data. This powers the
// /sweet-spots SEO guide tree: an index of programs and a per-program page of
// their standout redemptions, ranked by value.
//
// THESIS ALIGNMENT: these are SEED REFERENCE figures, not live quotes. "miles"
// is the typical good-case one-way figure (several programs moved to dynamic
// pricing in 2025-2026), so the UI must always surface VERIFY_CAVEAT. Nothing
// here is LLM-generated — it's hand-transcribed from the researched content
// plan, and every derived figure (ordering, counts) is computed below.

// The accuracy caveat the content plan attaches to the whole table. Every
// surface that renders a sweet spot must show this — these are seed figures,
// not guarantees, and dynamic pricing / devaluations move them.
export const VERIFY_CAVEAT =
  'Seed reference figures, not live quotes. Many programs use dynamic pricing — verify live before booking.'

export type Cabin = 'Economy' | 'Business' | 'First'

// Confidence in the figure as published. 'med' flags entries where value is
// real but the figure is soft (dynamic pricing, hard-to-use program, scarce
// space) — the UI can mark these honestly.
export type Confidence = 'high' | 'med'

export interface SweetSpot {
  /** Stable id, also the row key. */
  id: number
  /** Route or region, e.g. 'US ↔ Japan'. */
  route: string
  /** Human program name you book with (book-with currency), e.g. 'Virgin Atlantic'. */
  program: string
  /** URL-safe program slug for the per-program route segment. */
  programSlug: string
  /** Operating metal, when the value comes from a partner airline (e.g. 'ANA'). */
  metal?: string
  cabin: Cabin
  /** Typical good-case one-way miles. Undefined where the chart is purely
   *  distance-based (Avios) and no single figure is representative. */
  milesOW?: number
  /** Compact label for distance-based / banded pricing (e.g. '4k-7.5k'). */
  milesLabel: string
  /** Why it's a deal — the terse, factual one-liner from the seed table. */
  why: string
  confidence: Confidence
}

// The §2 seed table, verbatim in intent. milesOW is the single typical figure
// (used for ranking); milesLabel is what we render (carries ranges/"distance").
export const sweetSpots: SweetSpot[] = [
  {
    id: 1,
    route: 'US ↔ Japan',
    program: 'Virgin Atlantic',
    programSlug: 'virgin-atlantic',
    metal: 'ANA',
    cabin: 'First',
    milesOW: 57500,
    milesLabel: '55k–60k',
    why: 'Cash often tops $10k, so points clear ~8¢/pt. No fuel surcharges on ANA partner awards. Book early — award space is scarce.',
    confidence: 'high',
  },
  {
    id: 2,
    route: 'US ↔ Japan',
    program: 'Alaska / Atmos',
    programSlug: 'alaska-atmos',
    metal: 'JAL',
    cabin: 'Business',
    milesOW: 60000,
    milesLabel: '60k',
    why: 'JAL business for 60k and ~$50 in taxes, no fuel surcharges. JAL partner space is increasingly hard to find via Alaska.',
    confidence: 'high',
  },
  {
    id: 3,
    route: 'US ↔ Japan',
    program: 'Alaska / Atmos',
    programSlug: 'alaska-atmos',
    metal: 'JAL',
    cabin: 'First',
    milesOW: 70000,
    milesLabel: '70k',
    why: '777 First for 70k — one of the cheapest international First redemptions anywhere. Space is scarce.',
    confidence: 'high',
  },
  {
    id: 4,
    route: 'US ↔ Asia',
    program: 'Alaska / Atmos',
    programSlug: 'alaska-atmos',
    metal: 'Cathay Pacific',
    cabin: 'Business',
    milesOW: 50000,
    milesLabel: '50k',
    why: 'Cathay business to Asia runs $4.5k–7k cash. Free stopover on one-way partner awards (e.g. Hong Kong en route).',
    confidence: 'high',
  },
  {
    id: 5,
    route: 'US ↔ Asia',
    program: 'Alaska / Atmos',
    programSlug: 'alaska-atmos',
    metal: 'Cathay Pacific',
    cabin: 'First',
    milesOW: 70000,
    milesLabel: '70k',
    why: 'Cathay First at exceptional cents per point, with a free stopover allowed on the one-way.',
    confidence: 'high',
  },
  {
    id: 6,
    route: 'US ↔ Europe',
    program: 'Aeroplan',
    programSlug: 'aeroplan',
    metal: 'Star Alliance',
    cabin: 'Business',
    milesOW: 60000,
    milesLabel: '60k',
    why: 'Fixed-chart Star Alliance partners (ANA, Lufthansa, Swiss) for ~$3.5k–5.5k cash. Stopover is a flat +5k miles.',
    confidence: 'high',
  },
  {
    id: 7,
    route: 'US ↔ Europe',
    program: 'Virgin Atlantic',
    programSlug: 'virgin-atlantic',
    metal: 'Delta One',
    cabin: 'Business',
    milesOW: 50000,
    milesLabel: '50k',
    why: 'Often far cheaper than Delta SkyMiles for the same flat-bed seat, with no fuel surcharge on Delta partner awards.',
    confidence: 'high',
  },
  {
    id: 8,
    route: 'US ↔ Europe',
    program: 'Turkish Miles&Smiles',
    programSlug: 'turkish',
    metal: 'Star Alliance',
    cabin: 'Business',
    milesOW: 45000,
    milesLabel: '45k',
    why: 'ANA / Lufthansa / Swiss / United business for 45k vs $3.5k–5k cash → 9¢/pt+. Caveat: the website and transfers are notoriously hard to use.',
    confidence: 'med',
  },
  {
    id: 9,
    route: 'US ↔ Europe',
    program: 'Avianca LifeMiles',
    programSlug: 'lifemiles',
    metal: 'Lufthansa',
    cabin: 'First',
    milesOW: 110000,
    milesLabel: '100k–120k',
    why: 'Lufthansa First with zero fuel surcharges. Frequent Amex transfer bonuses cut the effective cost.',
    confidence: 'high',
  },
  {
    id: 10,
    route: 'Short-haul Europe (off-peak)',
    program: 'Avios',
    programSlug: 'avios',
    metal: 'BA / Iberia / Aer Lingus',
    cabin: 'Economy',
    milesOW: 6000,
    milesLabel: '4k–7.5k',
    why: 'Zone-1 off-peak (Dublin, Amsterdam, Paris) from ~4k Avios at low taxes. Distance-based chart; still strong short-haul post-devaluation.',
    confidence: 'high',
  },
  {
    id: 11,
    route: 'US ↔ Hawaii',
    program: 'Alaska / Atmos',
    programSlug: 'alaska-atmos',
    metal: 'Hawaiian / oneworld',
    cabin: 'Economy',
    milesOW: 15000,
    milesLabel: '10k–22k',
    why: 'From ~10k miles ex-California on Hawaiian via Alaska. Hawaiian is now oneworld, so Avios works too. Low taxes (~$6).',
    confidence: 'high',
  },
  {
    id: 12,
    route: 'US ↔ South America (Colombia)',
    program: 'Avianca LifeMiles',
    programSlug: 'lifemiles',
    cabin: 'Economy',
    milesOW: 16000,
    milesLabel: 'from 16k',
    why: 'Cheap into Bogotá / Medellín with no fuel surcharges, and transfer-bonus friendly.',
    confidence: 'high',
  },
  {
    id: 13,
    route: 'US ↔ Australia',
    program: 'Alaska / Atmos',
    programSlug: 'alaska-atmos',
    metal: 'Qantas',
    cabin: 'Business',
    milesOW: 55000,
    milesLabel: '55k',
    why: 'Qantas business across the Pacific for 55k — strong against cash and against other programs’ Pacific pricing.',
    confidence: 'high',
  },
  {
    id: 14,
    route: 'Middle East ↔ region / to US',
    program: 'Avios',
    programSlug: 'avios',
    metal: 'Qatar Qsuite',
    cabin: 'Business',
    milesOW: 70000,
    milesLabel: '70k (via Alaska)',
    why: 'Qatar Qsuite is widely rated the best business class. Bookable with Avios distance-based, or 70k one-way on the Alaska chart.',
    confidence: 'high',
  },
  {
    id: 15,
    route: 'US ↔ Asia',
    program: 'Aeroplan',
    programSlug: 'aeroplan',
    metal: 'Star Alliance',
    cabin: 'Business',
    milesOW: 102500,
    milesLabel: '~102.5k',
    why: 'Was 87.5k before the June 2026 devaluation. Still a long-distance band with a good ratio and a stopover option.',
    confidence: 'high',
  },
  {
    id: 16,
    route: 'Intra-Asia / Tokyo ↔ Sydney',
    program: 'Avianca LifeMiles',
    programSlug: 'lifemiles',
    metal: 'ANA',
    cabin: 'Business',
    milesOW: 40000,
    milesLabel: '40k',
    why: 'Tokyo–Sydney in ANA business for 40k, no surcharges.',
    confidence: 'med',
  },
]

// --- Program grouping --------------------------------------------------------

export interface Program {
  slug: string
  /** Display name, taken from the first spot's `program`. */
  name: string
  spots: SweetSpot[]
}

// Cabin rank for ordering within a program (First first, then Business, Economy).
const CABIN_RANK: Record<Cabin, number> = { First: 0, Business: 1, Economy: 2 }

// Order spots within a program: premium cabin first, then fewer miles first
// (cheaper redemption = stronger lead), undefined miles sink to the bottom.
function byValue(a: SweetSpot, b: SweetSpot): number {
  const c = CABIN_RANK[a.cabin] - CABIN_RANK[b.cabin]
  if (c !== 0) return c
  const ma = a.milesOW ?? Number.POSITIVE_INFINITY
  const mb = b.milesOW ?? Number.POSITIVE_INFINITY
  if (ma !== mb) return ma - mb
  return a.id - b.id
}

// Group the flat table by program, each program's spots ranked by value.
// Programs are ordered by how many standout redemptions they carry (most
// first) — the index leads with the programs that earn the most coverage.
export function sweetSpotsByProgram(): Program[] {
  const groups = new Map<string, Program>()
  for (const s of sweetSpots) {
    const g = groups.get(s.programSlug)
    if (g) {
      g.spots.push(s)
    } else {
      groups.set(s.programSlug, { slug: s.programSlug, name: s.program, spots: [s] })
    }
  }
  const out = [...groups.values()]
  for (const g of out) g.spots.sort(byValue)
  return out.sort((a, b) => b.spots.length - a.spots.length || a.name.localeCompare(b.name))
}

// All program slugs — drives generateStaticParams for the per-program route.
export function allPrograms(): string[] {
  return sweetSpotsByProgram().map((p) => p.slug)
}

// One program by slug, spots pre-ranked. Undefined for an unknown slug so the
// page can notFound().
export function programBySlug(slug: string): Program | undefined {
  return sweetSpotsByProgram().find((p) => p.slug === slug)
}
