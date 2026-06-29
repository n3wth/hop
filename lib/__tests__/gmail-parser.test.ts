import { describe, it, expect } from 'vitest'
import { parseMessage, parseMessages, deriveFavoriteRegions } from '@/lib/gmail-parser'
import type { RawMessage } from '@/lib/gmail'
import type { PastTrip } from '@/lib/travel-history'

// The parser is PURE — turns confirmation emails into normalized trip facts.
// These lock in the conservative heuristics: resolve a dataset destination,
// extract a month, read cabin/airline/points only when clearly present, and
// SKIP anything it can't place (a missed field is fine, a wrong one is not).

function msg(partial: Partial<RawMessage>): RawMessage {
  return {
    id: partial.id ?? 'm1',
    subject: partial.subject ?? '',
    from: partial.from ?? '',
    internalDate: partial.internalDate ?? 0,
    body: partial.body ?? '',
  }
}

describe('parseMessage()', () => {
  it('parses a United business-class flight to Tokyo booked with miles', () => {
    const t = parseMessage(
      msg({
        from: 'United Airlines <confirmation@united.com>',
        subject: 'Your trip confirmation to Tokyo (NRT)',
        body: 'Departing March 14, 2024 in United Polaris business class. 80,000 miles redeemed.',
      }),
    )
    expect(t).not.toBeNull()
    expect(t?.destinationCode).toBe('NRT')
    expect(t?.destinationCity).toBe('Tokyo')
    expect(t?.month).toBe('2024-03')
    expect(t?.airline).toBe('United')
    expect(t?.cabin).toBe('business')
    expect(t?.bookedWithPoints).toBe(true)
  })

  it('resolves a destination by city name when no IATA code is present', () => {
    const t = parseMessage(
      msg({
        from: 'noreply@delta.com',
        subject: 'Booking confirmed',
        body: 'Your trip to Paris departs on 2023-07-02 in main cabin.',
      }),
    )
    expect(t?.destinationCode).toBe('CDG')
    expect(t?.destinationCity).toBe('Paris')
    expect(t?.month).toBe('2023-07')
    expect(t?.cabin).toBe('economy')
    expect(t?.airline).toBe('Delta')
    expect(t?.bookedWithPoints).toBeUndefined()
  })

  it('does not attach a cabin/airline to a hotel confirmation', () => {
    const t = parseMessage(
      msg({
        from: 'reservations@marriott.com',
        subject: 'Reservation confirmed — Barcelona',
        body: 'Check-in February 10, 2024. Business center available.',
      }),
    )
    expect(t?.destinationCode).toBe('BCN')
    expect(t?.cabin).toBeUndefined() // "business center" must not read as a cabin
    expect(t?.airline).toBeUndefined()
    expect(t?.month).toBe('2024-02')
  })

  it('falls back to the email date when the body has no date', () => {
    const epoch = Date.UTC(2022, 10, 5) // Nov 2022
    const t = parseMessage(
      msg({ from: 'x@aa.com', subject: 'Itinerary to Lisbon', body: 'See you soon.', internalDate: epoch }),
    )
    expect(t?.month).toBe('2022-11')
  })

  it('returns null when no known destination resolves', () => {
    expect(
      parseMessage(msg({ from: 'x@united.com', subject: 'Confirmation', body: 'March 1, 2024' })),
    ).toBeNull()
  })

  it('returns null when no month can be found (and no email date)', () => {
    expect(
      parseMessage(msg({ from: 'x@united.com', subject: 'Trip to Tokyo', body: 'See you!' })),
    ).toBeNull()
  })
})

describe('parseMessages()', () => {
  it('dedupes on destination+month and merges richer fields', () => {
    const trips = parseMessages([
      msg({
        from: 'confirmation@united.com',
        subject: 'Trip to Tokyo NRT',
        body: 'March 14, 2024 economy',
      }),
      // A follow-up reminder for the SAME trip that adds the points flag.
      msg({
        from: 'reminders@united.com',
        subject: 'Your trip to Tokyo NRT is soon',
        body: 'March 14, 2024 — 80,000 miles',
      }),
    ])
    expect(trips).toHaveLength(1)
    expect(trips[0].cabin).toBe('economy')
    expect(trips[0].bookedWithPoints).toBe(true)
  })

  it('sorts trips by month ascending', () => {
    const trips = parseMessages([
      msg({ from: 'x@delta.com', subject: 'Trip to Rome FCO', body: 'July 1, 2024' }),
      msg({ from: 'x@delta.com', subject: 'Trip to Seoul ICN', body: 'January 5, 2024' }),
    ])
    expect(trips.map((t) => t.month)).toEqual(['2024-01', '2024-07'])
  })
})

describe('deriveFavoriteRegions()', () => {
  it('ranks regions by trip frequency, joining code → dataset region', () => {
    const trips: PastTrip[] = [
      { destinationCode: 'NRT', destinationCity: 'Tokyo', month: '2024-02' }, // Asia
      { destinationCode: 'ICN', destinationCity: 'Seoul', month: '2024-03' }, // Asia
      { destinationCode: 'CDG', destinationCity: 'Paris', month: '2024-07' }, // Europe
    ]
    expect(deriveFavoriteRegions(trips)).toEqual(['Asia', 'Europe'])
  })

  it('ignores trips with no resolvable code', () => {
    expect(
      deriveFavoriteRegions([{ destinationCity: 'Nowhere', month: '2024-01' }]),
    ).toEqual([])
  })
})
