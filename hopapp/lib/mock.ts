// SFO → LAX fixtures matching the locked design (docs/design/hop-v9.html).
// Used when upstreams are unconfigured or for design/dev work. Numbers and
// copy are lifted directly from the design so the UI renders pixel-faithfully.

import type { Balance, FlightOption } from '@/lib/types'
import { tier } from '@/lib/cpp'
import { pointsBookingUrl, cashBookingUrl } from '@/lib/booking'

const ROUTE = 'SFO → LAX'
const PARAMS = { from: 'SFO', to: 'LAX', depart: '2026-07-09', return: '2026-07-12', adults: 1 }

export function mockCash(): FlightOption[] {
  // United · Pay cash — $254 round-trip, ~$7.62 estimated earn.
  return [
    {
      id: 'mock-cash-ua',
      kind: 'cash',
      airline: 'United',
      airlineCode: 'UA',
      route: ROUTE,
      date: 'Jul 9',
      direct: true,
      cashPrice: 254,
      taxes: 0,
      roundTrip: true,
      earn: 7.62,
      cpp: undefined,
      tier: tier(undefined),
      bookingUrl: cashBookingUrl(PARAMS),
      note: 'Via Kiwi · we may earn a small commission',
    },
  ]
}

export function mockAwards(): FlightOption[] {
  return [
    {
      // Alaska Atmos — 4,500 mi, ~$11.20 taxes, 5.6¢/pt vs $254 cash. The pick.
      id: 'mock-award-as',
      kind: 'award',
      airline: 'Alaska Atmos',
      airlineCode: 'AS',
      program: 'Alaska Atmos Rewards',
      route: ROUTE,
      date: 'Jul 9',
      durationMin: 92,
      direct: true,
      miles: 4500,
      taxes: 11.2,
      cpp: 5.6,
      tier: tier(5.6),
      youHave: 42766,
      bookingUrl: pointsBookingUrl({ airlineCode: 'AS', program: 'Alaska Atmos Rewards' }),
      note: 'Operated by Alaska / American',
    },
    {
      // Southwest — ~6,000 pts, ~4.2¢/pt. Dynamic points pricing.
      id: 'mock-award-wn',
      kind: 'award',
      airline: 'Southwest',
      airlineCode: 'WN',
      program: 'Southwest Rapid Rewards',
      route: ROUTE,
      date: 'Jul 9',
      durationMin: 95,
      direct: true,
      miles: 6000,
      taxes: 5.6,
      cpp: 4.2,
      tier: tier(4.2),
      youHave: 36304,
      bookingUrl: pointsBookingUrl({ airlineCode: 'WN', program: 'Southwest Rapid Rewards' }),
      note: 'Points price varies · check Southwest',
    },
    {
      // United via Aeroplan — 10,000 mi transfer, 2.5¢/pt.
      id: 'mock-transfer-aeroplan',
      kind: 'transfer',
      airline: 'United',
      airlineCode: 'UA',
      program: 'Air Canada Aeroplan',
      route: ROUTE,
      date: 'Jul 9',
      direct: true,
      miles: 10000,
      taxes: 5.6,
      cpp: 2.5,
      tier: tier(2.5),
      youHave: 340358,
      transferFrom: [
        { source: 'Amex MR', ratio: '1:1' },
        { source: 'Chase UR', ratio: '1:1' },
      ],
      bookingUrl: pointsBookingUrl({ program: 'Air Canada Aeroplan' }),
      note: 'Transfer Amex MR or Chase UR → Aeroplan',
    },
    {
      // United MileagePlus — 14,100 mi, 1.8¢/pt. Dynamic, weak value.
      id: 'mock-award-ua',
      kind: 'award',
      airline: 'United MileagePlus',
      airlineCode: 'UA',
      program: 'United MileagePlus',
      route: ROUTE,
      date: 'Jul 11',
      direct: true,
      miles: 14100,
      taxes: 5.6,
      cpp: 1.8,
      tier: tier(1.8),
      youHave: 8540,
      bookingUrl: pointsBookingUrl({ airlineCode: 'UA', program: 'United MileagePlus' }),
      note: 'Dynamic pricing · weak value here',
    },
  ]
}

export function mockBalances(): Balance[] {
  return [
    { program: 'Amex Membership Rewards', code: 'AX', balance: 340358, status: 'Transferable' },
    { program: 'British Airways Avios', code: 'BA', balance: 103042, status: 'Bronze' },
    { program: 'Bilt Rewards', code: 'BR', balance: 49923, status: 'Blue' },
    { program: 'Chase Ultimate Rewards', code: 'UR', balance: 45921, status: 'Transferable' },
    { program: 'Alaska Atmos', code: 'AS', balance: 42766, status: 'Silver' },
    { program: 'Southwest Rapid Rewards', code: 'WN', balance: 36304, status: 'Ready' },
  ]
}
