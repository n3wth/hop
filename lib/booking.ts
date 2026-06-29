// Booking URL builders. Award redemptions deep-link to the airline's own
// award portal; cash deep-links to Kiwi (affiliate, deep-link ONLY in prod).

import type { SearchParams } from '@/lib/types'

// Award booking portals keyed by IATA airline code.
const AIRLINE_AWARD_URLS: Record<string, string> = {
  AS: 'https://www.alaskaair.com/booking',
  WN: 'https://www.southwest.com/air/booking/',
  UA: 'https://www.united.com/en/us/book-flight/united-reservations',
  AA: 'https://www.aa.com/booking/find-flights',
  DL: 'https://www.delta.com/flight-search/book-a-flight',
  B6: 'https://www.jetblue.com/booking/flights',
}

// Award booking portals keyed by loyalty program name (substring match).
// Program wins over airlineCode because transfers book in the program's portal,
// not necessarily the operating carrier's site (e.g. United via Aeroplan).
const PROGRAM_AWARD_URLS: Array<{ match: string; url: string }> = [
  { match: 'aeroplan', url: 'https://www.aircanada.com/aeroplan' },
  { match: 'alaska', url: 'https://www.alaskaair.com/booking' },
  { match: 'atmos', url: 'https://www.alaskaair.com/booking' },
  { match: 'southwest', url: 'https://www.southwest.com/air/booking/' },
  { match: 'rapid rewards', url: 'https://www.southwest.com/air/booking/' },
  { match: 'mileageplus', url: 'https://www.united.com/en/us/book-flight/united-reservations' },
  { match: 'united', url: 'https://www.united.com/en/us/book-flight/united-reservations' },
  { match: 'avios', url: 'https://www.britishairways.com/travel/redeem/execclub' },
  { match: 'british airways', url: 'https://www.britishairways.com/travel/redeem/execclub' },
  { match: 'virgin atlantic', url: 'https://www.virginatlantic.com/flying-club' },
  { match: 'delta', url: 'https://www.delta.com/flight-search/book-a-flight' },
]

const DEFAULT_AWARD_URL = 'https://www.google.com/travel/flights'

export function pointsBookingUrl(opt: { airlineCode?: string; program?: string }): string {
  const program = opt.program?.toLowerCase().trim()
  if (program) {
    const hit = PROGRAM_AWARD_URLS.find((p) => program.includes(p.match))
    if (hit) return hit.url
  }

  const code = opt.airlineCode?.toUpperCase().trim()
  if (code && AIRLINE_AWARD_URLS[code]) return AIRLINE_AWARD_URLS[code]

  return DEFAULT_AWARD_URL
}

// Kiwi is deep-link ONLY in production (no public search API for affiliate flow).
// Build a results deep-link for the route + dates.
export function cashBookingUrl(params: SearchParams): string {
  const from = encodeURIComponent(params.from.trim().toUpperCase())
  const to = encodeURIComponent(params.to.trim().toUpperCase())
  const depart = encodeURIComponent(params.depart)
  const segments = [`${from}/${to}/${depart}`]
  if (params.return) {
    segments.push(`${to}/${from}/${encodeURIComponent(params.return)}`)
  }
  const path = segments.join('/')
  const adults = Math.max(1, params.adults || 1)
  return `https://www.kiwi.com/en/search/results/${path}?adults=${adults}`
}
