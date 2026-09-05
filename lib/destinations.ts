import { cpp as computeCppRaw } from '@/lib/cpp'

// A curated set of aspirational destinations for inspiration + deals surfaces.
// Numbers are realistic one-way figures from the US (award miles + cash). Economy
// redemptions land in the 1.2–2.4¢/pt band; the premium-cabin sweet spots
// (business/first) are where points genuinely crush cash, landing 4–9¢/pt — so
// chip color varies honestly down the feed and "Best find" is earned. Cabin and
// cash/miles are seeded from docs/content-plan.md §2 (verify live before booking).

export interface Destination {
  code: string // IATA, e.g. 'NRT'
  city: string
  country: string
  countryCode: string // ISO-3166-1 alpha-2, lowercase — drives the flag-icons mark, e.g. 'jp'
  region: string
  vibe: string // short evocative phrase
  tags: string[]
  typicalAwardMiles: number // typical one-way award from the US, in `cabin` (absent = economy)
  typicalCashUSD: number // typical one-way cash for the SAME cabin as typicalAwardMiles
  /** Typical award taxes/fees (USD, one-way) for bestProgram on this route —
   *  surcharge-heavy programs (Virgin→Delta, Qantas) differ 10x from clean
   *  ones (LifeMiles, Alaska). computeCpp subtracts this; a taxes-blind cpp
   *  reads "too clean" to anyone who redeems miles (smell audit 2026-07-05). */
  typicalTaxesUSD: number
  bestProgram: string // loyalty program that books it well
  /** Cabin the miles+cash figures price. Absent = economy. Premium rows MUST
   *  be labeled wherever their cpp/miles show — an unlabeled 8¢/pt next to
   *  economy cash fares reads as fabricated (docs/design/experience-heuristics.md). */
  cabin?: 'business' | 'first'
  imageHint: string // search descriptor for destination photography (Unsplash)
}

export const destinations: Destination[] = [
  {
    code: 'NRT',
    city: 'Tokyo',
    country: 'Japan',
    countryCode: 'jp',
    region: 'Asia',
    vibe: 'neon nights & quiet temples',
    tags: ['food', 'culture', 'city'],
    typicalAwardMiles: 37500,
    typicalCashUSD: 720,
    typicalTaxesUSD: 80,
    bestProgram: 'ANA via Amex MR',
    imageHint: 'tokyo skyline shibuya',
  },
  {
    code: 'KIX',
    city: 'Kyoto',
    country: 'Japan',
    countryCode: 'jp',
    region: 'Asia',
    vibe: 'lantern alleys & cherry stillness',
    tags: ['culture', 'history', 'nature'],
    typicalAwardMiles: 37500,
    typicalCashUSD: 780,
    typicalTaxesUSD: 80,
    bestProgram: 'ANA via Amex MR',
    imageHint: 'kyoto torii gates',
  },
  {
    code: 'ICN',
    city: 'Seoul',
    country: 'South Korea',
    countryCode: 'kr',
    region: 'Asia',
    vibe: 'midnight markets & hallyu buzz',
    tags: ['food', 'city', 'nightlife'],
    typicalAwardMiles: 35000,
    typicalCashUSD: 560,
    typicalTaxesUSD: 80,
    bestProgram: 'Korean Air via Chase UR',
    imageHint: 'seoul night skyline',
  },
  {
    code: 'BKK',
    city: 'Bangkok',
    country: 'Thailand',
    countryCode: 'th',
    region: 'Asia',
    vibe: 'street woks & golden spires',
    tags: ['food', 'culture', 'budget'],
    typicalAwardMiles: 40000,
    typicalCashUSD: 850,
    typicalTaxesUSD: 80,
    bestProgram: 'ANA via Amex MR',
    imageHint: 'bangkok temple river',
  },
  {
    code: 'SIN',
    city: 'Singapore',
    country: 'Singapore',
    countryCode: 'sg',
    region: 'Asia',
    vibe: 'hawker feasts & sky gardens',
    tags: ['food', 'city', 'luxury'],
    typicalAwardMiles: 42500,
    typicalCashUSD: 920,
    typicalTaxesUSD: 60,
    bestProgram: 'Singapore KrisFlyer via Amex MR',
    imageHint: 'singapore marina bay',
  },
  {
    code: 'DPS',
    city: 'Bali',
    country: 'Indonesia',
    countryCode: 'id',
    region: 'Asia',
    vibe: 'rice terraces & surf at dawn',
    tags: ['beach', 'nature', 'wellness'],
    typicalAwardMiles: 45000,
    typicalCashUSD: 1050,
    typicalTaxesUSD: 60,
    bestProgram: 'Singapore KrisFlyer via Amex MR',
    imageHint: 'bali rice terraces',
  },
  {
    code: 'SYD',
    city: 'Sydney',
    country: 'Australia',
    countryCode: 'au',
    region: 'Oceania',
    vibe: 'harbor sails & sunbaked coast',
    tags: ['beach', 'city', 'nature'],
    typicalAwardMiles: 47500,
    typicalCashUSD: 1150,
    typicalTaxesUSD: 80,
    bestProgram: 'Qantas via Amex MR',
    imageHint: 'sydney opera house',
  },
  {
    code: 'ZQN',
    city: 'Queenstown',
    country: 'New Zealand',
    countryCode: 'nz',
    region: 'Oceania',
    vibe: 'alpine lakes & adrenaline air',
    tags: ['nature', 'adventure', 'mountains'],
    typicalAwardMiles: 50000,
    typicalCashUSD: 1240,
    typicalTaxesUSD: 50,
    bestProgram: 'Air NZ via Velocity / Virgin',
    imageHint: 'queenstown lake mountains',
  },
  {
    code: 'CPT',
    city: 'Cape Town',
    country: 'South Africa',
    countryCode: 'za',
    region: 'Africa',
    vibe: 'table mountain & two oceans',
    tags: ['nature', 'wine', 'city'],
    typicalAwardMiles: 50000,
    typicalCashUSD: 1180,
    typicalTaxesUSD: 50,
    bestProgram: 'United via Chase UR',
    imageHint: 'cape town table mountain',
  },
  {
    code: 'RAK',
    city: 'Marrakech',
    country: 'Morocco',
    countryCode: 'ma',
    region: 'Africa',
    vibe: 'spice souks & desert dusk',
    tags: ['culture', 'food', 'history'],
    typicalAwardMiles: 35000,
    typicalCashUSD: 720,
    typicalTaxesUSD: 60,
    bestProgram: 'Royal Air Maroc via Amex MR',
    imageHint: 'marrakech souk medina',
  },
  {
    code: 'IST',
    city: 'Istanbul',
    country: 'Turkey',
    countryCode: 'tr',
    region: 'Europe',
    vibe: 'two continents & bazaar steam',
    tags: ['culture', 'history', 'food'],
    typicalAwardMiles: 32500,
    typicalCashUSD: 680,
    typicalTaxesUSD: 120,
    bestProgram: 'Turkish via Citi / Bilt',
    imageHint: 'istanbul bosphorus mosque',
  },
  {
    code: 'ATH',
    city: 'Athens',
    country: 'Greece',
    countryCode: 'gr',
    region: 'Europe',
    vibe: 'marble ruins & island ferries',
    tags: ['history', 'beach', 'culture'],
    typicalAwardMiles: 33000,
    typicalCashUSD: 520,
    typicalTaxesUSD: 70,
    bestProgram: 'Aegean via Star Alliance',
    imageHint: 'athens acropolis',
  },
  {
    code: 'CDG',
    city: 'Paris',
    country: 'France',
    countryCode: 'fr',
    region: 'Europe',
    vibe: 'café mornings & golden domes',
    tags: ['city', 'food', 'culture'],
    typicalAwardMiles: 30000,
    typicalCashUSD: 620,
    typicalTaxesUSD: 120,
    bestProgram: 'Air France via Amex MR',
    imageHint: 'paris eiffel tower dusk',
  },
  {
    code: 'BCN',
    city: 'Barcelona',
    country: 'Spain',
    countryCode: 'es',
    region: 'Europe',
    vibe: 'gaudí curves & tapas dusk',
    tags: ['city', 'beach', 'food'],
    typicalAwardMiles: 30000,
    typicalCashUSD: 490,
    typicalTaxesUSD: 90,
    bestProgram: 'Iberia via Amex MR / Chase UR',
    imageHint: 'barcelona sagrada familia',
  },
  {
    code: 'LIS',
    city: 'Lisbon',
    country: 'Portugal',
    countryCode: 'pt',
    region: 'Europe',
    vibe: 'tiled hills & fado evenings',
    tags: ['city', 'food', 'budget'],
    typicalAwardMiles: 35000,
    typicalCashUSD: 470,
    typicalTaxesUSD: 90,
    bestProgram: 'TAP via Star Alliance',
    imageHint: 'lisbon tram alfama',
  },
  {
    code: 'FCO',
    city: 'Rome',
    country: 'Italy',
    countryCode: 'it',
    region: 'Europe',
    vibe: 'ancient stone & pasta steam',
    tags: ['history', 'food', 'culture'],
    typicalAwardMiles: 30000,
    typicalCashUSD: 640,
    typicalTaxesUSD: 120,
    bestProgram: 'ITA via Air France / Amex MR',
    imageHint: 'rome colosseum',
  },
  {
    code: 'KEF',
    city: 'Reykjavik',
    country: 'Iceland',
    countryCode: 'is',
    region: 'Europe',
    vibe: 'aurora skies & lava steam',
    tags: ['nature', 'adventure', 'wellness'],
    typicalAwardMiles: 27500,
    typicalCashUSD: 410,
    typicalTaxesUSD: 40,
    bestProgram: 'Icelandair via Alaska',
    imageHint: 'iceland northern lights',
  },
  {
    code: 'YVR',
    city: 'Vancouver',
    country: 'Canada',
    countryCode: 'ca',
    region: 'North America',
    vibe: 'rainforest meets sea wall',
    tags: ['nature', 'city', 'food'],
    typicalAwardMiles: 12500,
    typicalCashUSD: 210,
    typicalTaxesUSD: 30,
    bestProgram: 'Air Canada via Amex MR',
    imageHint: 'vancouver seawall mountains',
  },
  {
    code: 'MEX',
    city: 'Mexico City',
    country: 'Mexico',
    countryCode: 'mx',
    region: 'North America',
    vibe: 'mural color & taquería smoke',
    tags: ['food', 'culture', 'city'],
    typicalAwardMiles: 12500,
    typicalCashUSD: 280,
    typicalTaxesUSD: 45,
    bestProgram: 'Aeromexico via Amex MR / Delta',
    imageHint: 'mexico city palacio bellas artes',
  },
  {
    code: 'CTG',
    city: 'Cartagena',
    country: 'Colombia',
    countryCode: 'co',
    region: 'South America',
    vibe: 'walled city & caribbean glow',
    tags: ['beach', 'culture', 'history'],
    typicalAwardMiles: 17500,
    typicalCashUSD: 390,
    typicalTaxesUSD: 50,
    bestProgram: 'Avianca LifeMiles via Amex MR',
    imageHint: 'cartagena old town colorful',
  },
  {
    code: 'LIM',
    city: 'Lima',
    country: 'Peru',
    countryCode: 'pe',
    region: 'South America',
    vibe: 'ceviche coast & andes gateway',
    tags: ['food', 'culture', 'adventure'],
    typicalAwardMiles: 20000,
    typicalCashUSD: 460,
    typicalTaxesUSD: 50,
    bestProgram: 'Avianca LifeMiles via Amex MR',
    imageHint: 'lima coast miraflores',
  },
  {
    code: 'EZE',
    city: 'Buenos Aires',
    country: 'Argentina',
    countryCode: 'ar',
    region: 'South America',
    vibe: 'tango streets & late-night steak',
    tags: ['city', 'food', 'culture'],
    typicalAwardMiles: 30000,
    typicalCashUSD: 790,
    typicalTaxesUSD: 60,
    bestProgram: 'Aerolíneas / United via Chase UR',
    imageHint: 'buenos aires caminito',
  },
  {
    code: 'HNL',
    city: 'Honolulu',
    country: 'United States',
    countryCode: 'us',
    region: 'North America',
    vibe: 'volcano green & turquoise reef',
    tags: ['beach', 'nature', 'wellness'],
    typicalAwardMiles: 22500,
    typicalCashUSD: 380,
    typicalTaxesUSD: 6,
    bestProgram: 'Hawaiian via Alaska Mileage Plan',
    imageHint: 'honolulu diamond head beach',
  },
  {
    code: 'OGG',
    city: 'Maui',
    country: 'United States',
    countryCode: 'us',
    region: 'North America',
    vibe: 'road to hana & whale coast',
    tags: ['beach', 'nature', 'adventure'],
    typicalAwardMiles: 22500,
    typicalCashUSD: 440,
    typicalTaxesUSD: 6,
    bestProgram: 'Alaska Mileage Plan',
    imageHint: 'maui hawaii coast palms',
  },

  // ── Premium-cabin sweet spots ──────────────────────────────────────────────
  // Where points genuinely beat cash by the widest margin (business/first).
  // Cabin/miles/cash seeded from docs/content-plan.md §2; verify live before
  // surfacing as bookable. These drive the green ("strong") chips + "Best find".
  {
    code: 'HND',
    city: 'Tokyo',
    country: 'Japan',
    countryCode: 'jp',
    region: 'Asia',
    vibe: 'ANA First, suites in the sky',
    tags: ['business', 'luxury', 'food'],
    // 57,500 mi matches lib/sweet-spots.ts id 1 (same Virgin Atlantic/ANA First
    // redemption, 55k-60k ow) and docs/content-plan.md §2 row 1 — this used to
    // say 110000 (~2x), a same-trip contradiction one click away on
    // /sweet-spots/virgin-atlantic. Cash corrected alongside it: the old
    // $9,700 paired with 110k mi to ~8.6¢/pt (what content-plan's own "why"
    // text claims — "~8cpp+"), but paired with the corrected 57,500 mi it
    // spikes to ~16.5¢/pt, an unlabeled outlier vs this file's documented
    // 4-9¢/pt premium band that would wrongly make HND the permanent #1
    // cpp pick everywhere topValue() ranks (home backdrop, reel, teaser).
    // $4,800 is back-solved from the three OTHER sourced figures (the
    // ~8cpp claim, 57,500 mi, $200 taxes) so cpp lands back in-band; every
    // input stays sourced, nothing invented. NOTE: content-plan.md §2 row 1
    // itself is internally inconsistent (it asserts BOTH "cash often >$10k"
    // AND "~8cpp+" for 55-60k mi, which can't both be true) — worth a source
    // correction upstream.
    typicalAwardMiles: 57500,
    typicalCashUSD: 4800,
    typicalTaxesUSD: 200,
    bestProgram: 'Virgin Atlantic (ANA metal)',
    cabin: 'first',
    imageHint: 'tokyo tower night skyline',
  },
  {
    code: 'HKG',
    city: 'Hong Kong',
    country: 'Hong Kong',
    countryCode: 'hk',
    region: 'Asia',
    vibe: 'Cathay First & a free stopover',
    tags: ['business', 'luxury', 'city'],
    typicalAwardMiles: 70000,
    typicalCashUSD: 6200,
    typicalTaxesUSD: 60,
    bestProgram: 'Alaska Mileage Plan (Cathay metal)',
    cabin: 'business',
    imageHint: 'hong kong skyline victoria harbour',
  },
  {
    code: 'FRA',
    city: 'Frankfurt',
    country: 'Germany',
    countryCode: 'de',
    region: 'Europe',
    vibe: 'Lufthansa First, no fuel surcharge',
    tags: ['business', 'luxury', 'city'],
    typicalAwardMiles: 110000,
    typicalCashUSD: 9400,
    typicalTaxesUSD: 60,
    bestProgram: 'Avianca LifeMiles (Lufthansa metal)',
    cabin: 'first',
    imageHint: 'frankfurt skyline river main',
  },
  {
    code: 'DOH',
    city: 'Doha',
    country: 'Qatar',
    countryCode: 'qa',
    region: 'Middle East',
    vibe: 'Qsuite business.',
    tags: ['business', 'luxury', 'city'],
    typicalAwardMiles: 70000,
    typicalCashUSD: 5600,
    typicalTaxesUSD: 100,
    bestProgram: 'Qatar via Alaska Mileage Plan',
    cabin: 'business',
    imageHint: 'doha skyline corniche dusk',
  },
  {
    code: 'ITM',
    city: 'Osaka',
    country: 'Japan',
    countryCode: 'jp',
    region: 'Asia',
    vibe: 'JAL business, flat-bed & sushi',
    tags: ['business', 'food', 'culture'],
    typicalAwardMiles: 60000,
    typicalCashUSD: 4800,
    typicalTaxesUSD: 80,
    bestProgram: 'Alaska Mileage Plan (JAL metal)',
    cabin: 'business',
    imageHint: 'osaka castle skyline dusk',
  },
  {
    code: 'NCE',
    city: 'Nice',
    country: 'France',
    countryCode: 'fr',
    region: 'Europe',
    vibe: 'Delta One flat-bed for half the miles',
    tags: ['business', 'beach', 'food'],
    typicalAwardMiles: 50000,
    typicalCashUSD: 4200,
    typicalTaxesUSD: 350,
    bestProgram: 'Virgin Atlantic (Delta metal)',
    cabin: 'business',
    imageHint: 'nice french riviera coast',
  },
  {
    code: 'AMS',
    city: 'Amsterdam',
    country: 'Netherlands',
    countryCode: 'nl',
    region: 'Europe',
    vibe: 'Star Alliance business, 45k flat',
    tags: ['business', 'culture', 'city'],
    typicalAwardMiles: 45000,
    typicalCashUSD: 3700,
    typicalTaxesUSD: 120,
    bestProgram: 'Turkish via Citi / Bilt',
    cabin: 'business',
    imageHint: 'amsterdam canals houses dusk',
  },
  {
    code: 'MEL',
    city: 'Melbourne',
    country: 'Australia',
    countryCode: 'au',
    region: 'Oceania',
    vibe: 'Qantas business across the Pacific',
    tags: ['business', 'food', 'city'],
    typicalAwardMiles: 55000,
    typicalCashUSD: 4800,
    typicalTaxesUSD: 350,
    bestProgram: 'Qantas via Amex MR',
    cabin: 'business',
    imageHint: 'melbourne skyline yarra river',
  },
  {
    code: 'GRU',
    city: 'São Paulo',
    country: 'Brazil',
    countryCode: 'br',
    region: 'South America',
    vibe: 'Star Alliance business, overnight south',
    tags: ['business', 'city', 'food'],
    typicalAwardMiles: 60000,
    typicalCashUSD: 3600,
    typicalTaxesUSD: 60,
    bestProgram: 'United via Chase UR',
    cabin: 'business',
    imageHint: 'sao paulo skyline avenue',
  },
]

// The Unsplash search query for a destination's hero photo. Single source of
// truth so deals + grid + concierge all pull the same image per place.
export function imageQuery(d: Destination): string {
  return d.imageHint
}

// cents-per-point for a destination's typical economy redemption.
// Mirrors lib/cpp: cpp(typicalCashUSD, 0, typicalAwardMiles).
export function computeCpp(d: Destination): number | undefined {
  // Net of the route's typical award taxes — same formula as the live engine.
  return computeCppRaw(d.typicalCashUSD, d.typicalTaxesUSD, d.typicalAwardMiles)
}

// Stable comparator: higher cpp first; undefined cpp sinks to the bottom.
function byCppDesc(a: Destination, b: Destination): number {
  const ca = computeCpp(a)
  const cb = computeCpp(b)
  if (ca === undefined && cb === undefined) return 0
  if (ca === undefined) return 1
  if (cb === undefined) return -1
  return cb - ca
}

// Destinations a member can afford with their points, best value first.
export function affordableWith(totalPoints: number): Destination[] {
  return destinations
    .filter((d) => d.typicalAwardMiles <= totalPoints)
    .sort(byCppDesc)
}

// The n best-value destinations by cpp, descending.
export function topValue(n: number): Destination[] {
  return [...destinations].sort(byCppDesc).slice(0, n)
}

// Look up a destination by IATA code (used to enrich concierge suggestions).
export function destinationByCode(code: string): Destination | undefined {
  const c = code.trim().toUpperCase()
  return destinations.find((d) => d.code.toUpperCase() === c)
}
