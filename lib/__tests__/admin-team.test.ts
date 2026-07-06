import { describe, it, expect } from 'vitest'
import { nextCronRun, formatNextRun } from '../admin-team'

describe('nextCronRun()', () => {
  it('returns later today when the time has not passed yet', () => {
    // Jeffrey: daily 14:32 UTC. "Now" is 10:00 UTC same day.
    const from = new Date('2026-07-06T10:00:00.000Z')
    const next = nextCronRun('32 14 * * *', from)
    expect(next.toISOString()).toBe('2026-07-06T14:32:00.000Z')
  })

  it('rolls to tomorrow when today\'s time has already passed', () => {
    const from = new Date('2026-07-06T20:00:00.000Z')
    const next = nextCronRun('32 14 * * *', from)
    expect(next.toISOString()).toBe('2026-07-07T14:32:00.000Z')
  })

  it('skips forward to the next allowed day-of-week (Sun -> Mon)', () => {
    // Omar: Mon/Wed/Fri 15:00 UTC. 2026-07-05 is a Sunday.
    const from = new Date('2026-07-05T09:00:00.000Z')
    const next = nextCronRun('0 15 * * 1,3,5', from)
    expect(next.getUTCDay()).toBe(1) // Monday
    expect(next.toISOString()).toBe('2026-07-06T15:00:00.000Z')
  })

  it('skips past a same-day match once that time has passed', () => {
    // Monday 2026-07-06, already past 15:00 -> next is Wednesday, not today.
    const from = new Date('2026-07-06T16:00:00.000Z')
    const next = nextCronRun('0 15 * * 1,3,5', from)
    expect(next.getUTCDay()).toBe(3) // Wednesday
    expect(next.toISOString()).toBe('2026-07-08T15:00:00.000Z')
  })

  it('handles a single weekly day-of-week (Elizabeth: Tue 17:00 UTC)', () => {
    const from = new Date('2026-07-06T00:00:00.000Z') // Monday
    const next = nextCronRun('0 17 * * 2', from)
    expect(next.toISOString()).toBe('2026-07-07T17:00:00.000Z')
  })
})

describe('formatNextRun()', () => {
  const from = new Date('2026-07-06T10:00:00.000Z')

  it('formats sub-hour gaps in minutes', () => {
    expect(formatNextRun(new Date('2026-07-06T10:30:00.000Z'), from)).toBe('in 30m')
  })

  it('formats sub-two-day gaps in hours', () => {
    expect(formatNextRun(new Date('2026-07-06T14:00:00.000Z'), from)).toBe('in 4h')
  })

  it('formats multi-day gaps in days', () => {
    expect(formatNextRun(new Date('2026-07-09T10:00:00.000Z'), from)).toBe('in 3d')
  })

  it('reports due now for a non-future target', () => {
    expect(formatNextRun(from, from)).toBe('due now')
    expect(formatNextRun(new Date('2026-07-06T09:00:00.000Z'), from)).toBe('due now')
  })
})
