import { describe, it, expect } from 'vitest'
import {
  renderBusinessDigest,
  weekWindow,
  type BusinessDigest,
} from '@/lib/business-digest'

// A fully-resolved week: every source counted.
function fullDigest(): BusinessDigest {
  return {
    window: { start: '2026-06-25T14:07:00.000Z', end: '2026-07-02T14:07:00.000Z' },
    escalations: { count: 3, prev: 1 },
    ordersCreated: { count: 2, prev: 5 },
    alertsFired: { count: 12, prev: 8 },
    activeWatches: 5,
    activeSubscriptions: 1,
    outclicks: { count: 4, prev: 2, total: 4 },
  }
}

describe('renderBusinessDigest', () => {
  it('states every counted number plainly, with week framing', () => {
    const r = renderBusinessDigest(fullDigest())
    expect(r).not.toBeNull()
    expect(r!.subject).toBe(
      'hop this week: 3 booking requests · 2 new watches · 12 alerts fired · 5 active watches · 1 paid subscriber · 4 card outclicks',
    )
    // Week framing (UTC dates) in the body header.
    expect(r!.text).toContain('hop, Jun 25 – Jul 2.')
    // Body lines: current count + last week's, both stated plainly.
    expect(r!.text).toContain('Booking requests: 3 (last week 1)')
    expect(r!.text).toContain('New watches: 2 (last week 5)')
    expect(r!.text).toContain('Alerts fired: 12 (last week 8)')
    expect(r!.text).toContain('Active watches: 5')
    expect(r!.text).toContain('Paid subscribers: 1')
    expect(r!.text).toContain('Card outclicks: 4 (last week 2)')
    // total === card count (card is the only kind) → no redundant total suffix.
    expect(r!.text).not.toContain('total')
    expect(r!.sections).toEqual([
      'escalations',
      'ordersCreated',
      'alertsFired',
      'activeWatches',
      'activeSubscriptions',
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
  })

  it('omits a section entirely when its source degraded (null)', () => {
    const d = fullDigest()
    d.escalations = null
    d.activeSubscriptions = null // e.g. hop_subscriptions doesn't exist yet
    d.outclicks = null // e.g. hop_outclicks migration not applied yet
    const r = renderBusinessDigest(d)
    expect(r).not.toBeNull()
    expect(r!.sections).toEqual(['ordersCreated', 'alertsFired', 'activeWatches'])
    expect(r!.subject).not.toContain('booking request')
    expect(r!.subject).not.toContain('subscriber')
    expect(r!.subject).not.toContain('outclick')
    expect(r!.text).not.toContain('Booking requests')
    expect(r!.text).not.toContain('Paid subscribers')
    expect(r!.text).not.toContain('Card outclicks')
    expect(r!.html).not.toContain('Booking requests')
  })

  it('returns null when every source degraded — nothing true to say', () => {
    const r = renderBusinessDigest({
      window: { start: '2026-06-25T14:07:00.000Z', end: '2026-07-02T14:07:00.000Z' },
      escalations: null,
      ordersCreated: null,
      alertsFired: null,
      activeWatches: null,
      activeSubscriptions: null,
      outclicks: null,
    })
    expect(r).toBeNull()
  })

  it('renders a genuinely quiet week as zeros, not omission or fabrication', () => {
    const r = renderBusinessDigest({
      window: { start: '2026-06-25T14:07:00.000Z', end: '2026-07-02T14:07:00.000Z' },
      escalations: { count: 0, prev: 0 },
      ordersCreated: { count: 0, prev: null },
      alertsFired: null,
      activeWatches: 0,
      activeSubscriptions: null,
      outclicks: { count: 0, prev: null, total: 0 },
    })
    expect(r).not.toBeNull()
    expect(r!.subject).toBe(
      'hop this week: 0 booking requests · 0 new watches · 0 active watches · 0 card outclicks',
    )
    expect(r!.text).toContain('Booking requests: 0 (last week 0)')
    // prev degraded → the comparison is dropped, not invented.
    expect(r!.text).toContain('New watches: 0\n')
    expect(r!.text).not.toContain('New watches: 0 (last week')
    expect(r!.text).toContain('Card outclicks: 0\n')
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
    d.outclicks = { count: 1, prev: 0, total: 1 }
    const r = renderBusinessDigest(d)!
    expect(r.subject).toContain('1 booking request ·')
    expect(r.subject).toContain('1 active watch ·')
    expect(r.subject).toContain('1 card outclick')
    expect(r.subject).not.toContain('1 card outclicks')
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
