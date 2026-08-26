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

  it('resolves a destination by IATA code (city names alone no longer resolve)', () => {
    const t = parseMessage(
      msg({
        from: 'noreply@delta.com',
        subject: 'Booking confirmed',
        body: 'Your trip to Paris (CDG) departs on 2023-07-02 in main cabin.',
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
        subject: 'Reservation confirmed — Barcelona BCN',
        body: 'Check-in February 10, 2024. Business center available.',
      }),
    )
    expect(t?.destinationCode).toBe('BCN')
    expect(t?.cabin).toBeUndefined() // "business center" must not read as a cabin
    expect(t?.airline).toBeUndefined()
    expect(t?.month).toBe('2024-02')
  })

  it('returns null when no known destination resolves', () => {
    expect(
      parseMessage(msg({ from: 'x@united.com', subject: 'Confirmation', body: 'March 1, 2024' })),
    ).toBeNull()
  })

  it('returns null when the body has no date — the received-date fallback is gone', () => {
    // internalDate is set: the old parser would have stamped Nov 2022 here.
    const epoch = Date.UTC(2022, 10, 5)
    expect(
      parseMessage(
        msg({ from: 'x@united.com', subject: 'Trip to Tokyo NRT', body: 'See you!', internalDate: epoch }),
      ),
    ).toBeNull()
  })

  it('takes the DESTINATION of a route pattern, not the origin or first code seen', () => {
    const t = parseMessage(
      msg({
        from: 'noreply@delta.com',
        subject: 'Your trip confirmation',
        body: 'Flight DL 84: FCO to CDG, departing May 2, 2025. Ticket total $412.18 paid by card.',
      }),
    )
    // A bare-code scan would return FCO (first match); the route wins.
    expect(t?.destinationCode).toBe('CDG')
    expect(t?.month).toBe('2025-05')
  })

  it('prefers the latest plausible date when several parse (booked-on vs travel)', () => {
    const t = parseMessage(
      msg({
        from: 'confirmation@united.com',
        subject: 'Trip to Tokyo NRT',
        body: 'Booked on January 3, 2024. Departing March 14, 2024.',
      }),
    )
    expect(t?.month).toBe('2024-03')
  })

  it('does not set bookedWithPoints on a cash ticket with an earn-miles footer', () => {
    const t = parseMessage(
      msg({
        from: 'confirmation@united.com',
        subject: 'Trip to Tokyo NRT',
        body: 'Departing March 14, 2024. Ticket total $842.00 paid by Visa. You will earn 4,210 miles on this trip.',
      }),
    )
    expect(t).not.toBeNull()
    expect(t?.bookedWithPoints).toBeUndefined()
  })

  // Adversarial fixtures — the exact false-positive mechanisms from the audit.
  // None of these are trips; all MUST return null.

  it('rejects a bank promo (sender gate): "Chrome" is not Rome, "climate" is not Lima', () => {
    expect(
      parseMessage(
        msg({
          from: 'Chase <no-reply@chase.com>',
          subject: 'Your offer is waiting',
          body: 'View this email in Chrome. Read about our climate commitment. Offer ends March 31, 2025.',
          internalDate: Date.UTC(2025, 2, 1),
        }),
      ),
    ).toBeNull()
  })

  it('rejects a bank statement containing "price comparison"', () => {
    expect(
      parseMessage(
        msg({
          from: 'statements@bankofamerica.com',
          subject: 'Your statement is ready',
          body: 'See a price comparison of our accounts. Statement date: July 1, 2025.',
          internalDate: Date.UTC(2025, 6, 1),
        }),
      ),
    ).toBeNull()
  })

  it('rejects a mileage statement from a real airline sender (no destination, earn-only)', () => {
    expect(
      parseMessage(
        msg({
          from: 'MileagePlus <mileageplus@united.com>',
          subject: 'Your MileagePlus statement',
          body: 'You earned 1,234 miles. Balance as of August 1, 2024.',
          internalDate: Date.UTC(2024, 7, 1),
        }),
      ),
    ).toBeNull()
  })

  it('rejects airline marketing that only names cities (no IATA code)', () => {
    expect(
      parseMessage(
        msg({
          from: 'offers@united.com',
          subject: 'Our newest routes',
          body: 'Now flying to Venice and Rome. Book by March 31, 2025.',
        }),
      ),
    ).toBeNull()
  })
})

describe('parseMessages()', () => {
  it('dedupes on destination+month and merges richer fields', () => {
    const trips = parseMessages([
      msg({
        from: 'confirmation@united.com',
        subject: 'Trip to Tokyo NRT',
        body: 'Booking: March 14, 2024, economy',
      }),
      // A follow-up reminder for the SAME trip that adds the points flag.
      msg({
        from: 'reminders@united.com',
        subject: 'Your trip to Tokyo NRT is soon',
        body: 'Award ticket: March 14, 2024 — 80,000 miles',
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
