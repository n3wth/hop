import { describe, it, expect } from 'vitest'
import {
<<<<<<< HEAD
  bucketWeeks,
  renderBusinessDigest,
  weekWindow,
  TREND_WEEKS,
=======
  renderBusinessDigest,
  weekWindow,
>>>>>>> origin/claude/business-digest
  type BusinessDigest,
} from '@/lib/business-digest'

// A fully-resolved week: every source counted.
function fullDigest(): BusinessDigest {
  return {
    window: { start: '2026-06-25T14:07:00.000Z', end: '2026-07-02T14:07:00.000Z' },
<<<<<<< HEAD
    activeUsers: { count: 9, prev: 7, trend: [1, 2, 2, 4, 5, 6, 7, 9] },
=======
>>>>>>> origin/claude/business-digest
    escalations: { count: 3, prev: 1 },
    ordersCreated: { count: 2, prev: 5 },
    alertsFired: { count: 12, prev: 8 },
    activeWatches: 5,
    activeSubscriptions: 1,
<<<<<<< HEAD
    outclicks: { count: 4, prev: 2, total: 4 },
=======
>>>>>>> origin/claude/business-digest
  }
}

describe('renderBusinessDigest', () => {
  it('states every counted number plainly, with week framing', () => {
    const r = renderBusinessDigest(fullDigest())
    expect(r).not.toBeNull()
    expect(r!.subject).toBe(
<<<<<<< HEAD
      'hop this week: 9 active users · 3 booking requests · 2 new watches · 12 alerts fired · 5 active watches · 1 paid subscriber · 4 card outclicks',
=======
      'hop this week: 3 booking requests · 2 new watches · 12 alerts fired · 5 active watches · 1 paid subscriber',
>>>>>>> origin/claude/business-digest
    )
    // Week framing (UTC dates) in the body header.
    expect(r!.text).toContain('hop, Jun 25 – Jul 2.')
    // Body lines: current count + last week's, both stated plainly.
<<<<<<< HEAD
    expect(r!.text).toContain('Active users: 9 (last week 7)')
=======
>>>>>>> origin/claude/business-digest
    expect(r!.text).toContain('Booking requests: 3 (last week 1)')
    expect(r!.text).toContain('New watches: 2 (last week 5)')
    expect(r!.text).toContain('Alerts fired: 12 (last week 8)')
    expect(r!.text).toContain('Active watches: 5')
    expect(r!.text).toContain('Paid subscribers: 1')
<<<<<<< HEAD
    expect(r!.text).toContain('Card outclicks: 4 (last week 2)')
    // total === card count (card is the only kind) → no redundant total suffix.
    expect(r!.text).not.toContain('total')
    expect(r!.sections).toEqual([
      'activeUsers',
=======
    expect(r!.sections).toEqual([
>>>>>>> origin/claude/business-digest
      'escalations',
      'ordersCreated',
      'alertsFired',
      'activeWatches',
      'activeSubscriptions',
<<<<<<< HEAD
      'outclicks',
    ])
    // HTML mirrors the same lines (flat, no fabricated extras).
    expect(r!.html).toContain('Alerts fired: 12 (last week 8)')
    expect(r!.html).toContain('Card outclicks: 4 (last week 2)')
  })

  it('appends the all-kinds total to the outclick line only when it differs', () => {
    const d = fullDigest()
    d.outclicks = { count: 3, prev: 1, total: 5 }
    const r = renderBusinessDigest(d)!
    expect(r.text).toContain('Card outclicks: 3 (last week 1) · 5 total')
    // A degraded total is dropped, not invented.
    d.outclicks = { count: 3, prev: 1, total: null }
    const r2 = renderBusinessDigest(d)!
    expect(r2.text).toContain('Card outclicks: 3 (last week 1)\n')
    expect(r2.text).not.toContain('total')
=======
    ])
    // HTML mirrors the same lines (flat, no fabricated extras).
    expect(r!.html).toContain('Alerts fired: 12 (last week 8)')
>>>>>>> origin/claude/business-digest
  })

  it('omits a section entirely when its source degraded (null)', () => {
    const d = fullDigest()
<<<<<<< HEAD
    d.activeUsers = null
    d.escalations = null
    d.activeSubscriptions = null // e.g. hop_subscriptions doesn't exist yet
    d.outclicks = null // e.g. hop_outclicks migration not applied yet
=======
    d.escalations = null
    d.activeSubscriptions = null // e.g. hop_subscriptions doesn't exist yet
>>>>>>> origin/claude/business-digest
    const r = renderBusinessDigest(d)
    expect(r).not.toBeNull()
    expect(r!.sections).toEqual(['ordersCreated', 'alertsFired', 'activeWatches'])
    expect(r!.subject).not.toContain('booking request')
    expect(r!.subject).not.toContain('subscriber')
<<<<<<< HEAD
    expect(r!.subject).not.toContain('outclick')
    expect(r!.text).not.toContain('Booking requests')
    expect(r!.text).not.toContain('Paid subscribers')
    expect(r!.text).not.toContain('Card outclicks')
=======
    expect(r!.text).not.toContain('Booking requests')
    expect(r!.text).not.toContain('Paid subscribers')
>>>>>>> origin/claude/business-digest
    expect(r!.html).not.toContain('Booking requests')
  })

  it('returns null when every source degraded — nothing true to say', () => {
    const r = renderBusinessDigest({
      window: { start: '2026-06-25T14:07:00.000Z', end: '2026-07-02T14:07:00.000Z' },
<<<<<<< HEAD
      activeUsers: null,
=======
>>>>>>> origin/claude/business-digest
      escalations: null,
      ordersCreated: null,
      alertsFired: null,
      activeWatches: null,
      activeSubscriptions: null,
<<<<<<< HEAD
      outclicks: null,
=======
>>>>>>> origin/claude/business-digest
    })
    expect(r).toBeNull()
  })

  it('renders a genuinely quiet week as zeros, not omission or fabrication', () => {
    const r = renderBusinessDigest({
      window: { start: '2026-06-25T14:07:00.000Z', end: '2026-07-02T14:07:00.000Z' },
<<<<<<< HEAD
      activeUsers: null,
=======
>>>>>>> origin/claude/business-digest
      escalations: { count: 0, prev: 0 },
      ordersCreated: { count: 0, prev: null },
      alertsFired: null,
      activeWatches: 0,
      activeSubscriptions: null,
<<<<<<< HEAD
      outclicks: { count: 0, prev: null, total: 0 },
    })
    expect(r).not.toBeNull()
    expect(r!.subject).toBe(
      'hop this week: 0 booking requests · 0 new watches · 0 active watches · 0 card outclicks',
    )
=======
    })
    expect(r).not.toBeNull()
    expect(r!.subject).toBe('hop this week: 0 booking requests · 0 new watches · 0 active watches')
>>>>>>> origin/claude/business-digest
    expect(r!.text).toContain('Booking requests: 0 (last week 0)')
    // prev degraded → the comparison is dropped, not invented.
    expect(r!.text).toContain('New watches: 0\n')
    expect(r!.text).not.toContain('New watches: 0 (last week')
<<<<<<< HEAD
    expect(r!.text).toContain('Card outclicks: 0\n')
=======
>>>>>>> origin/claude/business-digest
  })

  it('never leaks placeholder values into the copy', () => {
    const d = fullDigest()
    d.alertsFired = null
    d.ordersCreated = { count: 4, prev: null }
    const r = renderBusinessDigest(d)!
    for (const body of [r.subject, r.text, r.html]) {
      expect(body).not.toMatch(/undefined|null|NaN/)
    }
  })

  it('uses singular forms for counts of one', () => {
    const d = fullDigest()
    d.escalations = { count: 1, prev: 0 }
    d.activeWatches = 1
<<<<<<< HEAD
    d.outclicks = { count: 1, prev: 0, total: 1 }
    const r = renderBusinessDigest(d)!
    expect(r.subject).toContain('1 booking request ·')
    expect(r.subject).toContain('1 active watch ·')
    expect(r.subject).toContain('1 card outclick')
    expect(r.subject).not.toContain('1 card outclicks')
=======
    const r = renderBusinessDigest(d)!
    expect(r.subject).toContain('1 booking request ·')
    expect(r.subject).toContain('1 active watch ·')
>>>>>>> origin/claude/business-digest
  })
})

describe('weekWindow', () => {
  it('bounds the last 7 days and the 7 before that', () => {
    const now = new Date('2026-07-02T14:07:00.000Z')
    const w = weekWindow(now)
    expect(w.end).toBe('2026-07-02T14:07:00.000Z')
    expect(w.start).toBe('2026-06-25T14:07:00.000Z')
    expect(w.prevStart).toBe('2026-06-18T14:07:00.000Z')
  })
})
<<<<<<< HEAD

describe('bucketWeeks', () => {
  const NOW = new Date('2026-07-02T14:07:00.000Z')
  const WEEK = 7 * 24 * 60 * 60 * 1000

  it('returns TREND_WEEKS zero buckets for no timestamps', () => {
    expect(bucketWeeks([], NOW)).toEqual(new Array(TREND_WEEKS).fill(0))
  })

  it('puts a just-now stamp in the last bucket and an old one in the first', () => {
    const justNow = new Date(NOW.getTime() - 1000).toISOString()
    const sevenWeeksAgo = new Date(NOW.getTime() - 7.5 * WEEK).toISOString()
    const buckets = bucketWeeks([justNow, sevenWeeksAgo], NOW)
    expect(buckets[TREND_WEEKS - 1]).toBe(1)
    expect(buckets[0]).toBe(1)
    expect(buckets.reduce((a, b) => a + b, 0)).toBe(2)
  })

  it('drops out-of-range and unparseable stamps instead of guessing', () => {
    const tooOld = new Date(NOW.getTime() - (TREND_WEEKS + 1) * WEEK).toISOString()
    const future = new Date(NOW.getTime() + 1000).toISOString()
    expect(bucketWeeks([tooOld, future, 'garbage', null, undefined], NOW)).toEqual(
      new Array(TREND_WEEKS).fill(0),
    )
  })

  it('respects exact week boundaries ([start, end) per bucket)', () => {
    // Exactly one week ago = the first instant of the current-week bucket
    // (buckets are [start, end), matching weekWindow's framing) — one tick
    // earlier lands in the previous bucket.
    const exactlyOneWeekAgo = new Date(NOW.getTime() - WEEK).toISOString()
    const aTickEarlier = new Date(NOW.getTime() - WEEK - 1).toISOString()
    const buckets = bucketWeeks([exactlyOneWeekAgo, aTickEarlier], NOW)
    expect(buckets[TREND_WEEKS - 1]).toBe(1)
    expect(buckets[TREND_WEEKS - 2]).toBe(1)
  })

  it('accepts Date objects as well as ISO strings', () => {
    const buckets = bucketWeeks([new Date(NOW.getTime() - 1000)], NOW)
    expect(buckets[TREND_WEEKS - 1]).toBe(1)
  })
})
=======
>>>>>>> origin/claude/business-digest
