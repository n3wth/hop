import { cpp as computeCppRaw } from '@/lib/cpp'

// A curated set of aspirational destinations for inspiration + deals surfaces.
// Numbers are realistic one-way economy figures from the US (award miles + cash),
// tuned so cpp values land in a believable range for points redemptions.

export interface Destination {
  code: string // IATA, e.g. 'NRT'
  city: string
  country: string
  countryCode: string // ISO-3166-1 alpha-2, lowercase — drives the flag-icons mark, e.g. 'jp'
  region: string
  vibe: string // short evocative phrase
  tags: string[]
  typicalAwardMiles: number // realistic one-way economy award from the US
  typicalCashUSD: number // realistic one-way cash
  bestProgram: string // loyalty program that books it well
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
    typicalCashUSD: 690,
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
    typicalCashUSD: 640,
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
    typicalCashUSD: 760,
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
    typicalCashUSD: 810,
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
    typicalCashUSD: 880,
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
    typicalCashUSD: 1010,
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
    typicalCashUSD: 1080,
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
    typicalCashUSD: 990,
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
    typicalCashUSD: 640,
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
    typicalCashUSD: 600,
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
    typicalAwardMiles: 30000,
    typicalCashUSD: 560,
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
    typicalCashUSD: 580,
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
    typicalCashUSD: 540,
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
    typicalAwardMiles: 30000,
    typicalCashUSD: 520,
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
    typicalCashUSD: 590,
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
    typicalCashUSD: 480,
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
    typicalCashUSD: 240,
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
    typicalCashUSD: 260,
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
    typicalCashUSD: 340,
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
    typicalCashUSD: 410,
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
    typicalCashUSD: 660,
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
    typicalCashUSD: 420,
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
    typicalCashUSD: 450,
    bestProgram: 'Alaska Mileage Plan',
    imageHint: 'maui hawaii coast palms',
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
  return computeCppRaw(d.typicalCashUSD, 0, d.typicalAwardMiles)
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
