import { describe, it, expect } from 'vitest'
import {
  normalizeSubject,
  recurringDismissed,
  deriveObservations,
  OUTCOME_KINDS,
} from '@/lib/memory-outcomes'

describe('normalizeSubject', () => {
  it('trims and bounds a usable label', () => {
    expect(normalizeSubject('  Tokyo  ')).toBe('Tokyo')
    expect(normalizeSubject('x'.repeat(80))).toHaveLength(48)
  })
  it('rejects empty / non-string', () => {
    expect(normalizeSubject('   ')).toBeNull()
    expect(normalizeSubject(42)).toBeNull()
    expect(normalizeSubject(undefined)).toBeNull()
    expect(normalizeSubject(null)).toBeNull()
  })
})

describe('recurringDismissed', () => {
  it('surfaces a subject only once it RECURS (>= 2), never a one-off', () => {
    const rows = [
      { kind: 'dismissed_verdict', subject: 'Tokyo' },
      { kind: 'dismissed_verdict', subject: 'Tokyo' },
      { kind: 'dismissed_verdict', subject: 'Lisbon' }, // one-off → dropped
    ]
    const out = recurringDismissed(rows)
    expect(out).toEqual([{ subject: 'Tokyo', count: 2 }])
  })

  it('groups case-insensitively but keeps the first-seen display casing', () => {
    const rows = [
      { kind: 'dismissed_verdict', subject: 'Cancun' },
      { kind: 'dismissed_verdict', subject: 'cancun' },
    ]
    expect(recurringDismissed(rows)).toEqual([{ subject: 'Cancun', count: 2 }])
  })

  it('orders by count desc, then alphabetically', () => {
    const rows = [
      { kind: 'dismissed_verdict', subject: 'Oslo' },
      { kind: 'dismissed_verdict', subject: 'Oslo' },
      { kind: 'dismissed_verdict', subject: 'Athens' },
      { kind: 'dismissed_verdict', subject: 'Athens' },
      { kind: 'dismissed_verdict', subject: 'Athens' },
    ]
    expect(recurringDismissed(rows).map((c) => c.subject)).toEqual(['Athens', 'Oslo'])
  })

  it('ignores other kinds and garbage rows', () => {
    const rows = [
      { kind: 'booked_trip', subject: 'Paris' },
      { kind: 'booked_trip', subject: 'Paris' },
      { kind: 'dismissed_verdict', subject: '   ' },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      null as any,
    ]
    expect(recurringDismissed(rows)).toEqual([])
  })
})

describe('deriveObservations', () => {
  it('produces human, economics-free rows with a stable id', () => {
    const rows = [
      { kind: 'dismissed_verdict', subject: 'Tokyo' },
      { kind: 'dismissed_verdict', subject: 'Tokyo' },
    ]
    const obs = deriveObservations(rows)
    expect(obs).toHaveLength(1)
    expect(obs[0].id).toBe('dismissed:tokyo')
    expect(obs[0].text).toContain('Tokyo')
    // no numbers/economics leak into the copy
    expect(obs[0].text).not.toMatch(/\d|\$|cpp|miles|points/i)
  })

  it('varies phrasing between "more than once" and "a few times"', () => {
    const twice = deriveObservations([
      { kind: 'dismissed_verdict', subject: 'Lisbon' },
      { kind: 'dismissed_verdict', subject: 'Lisbon' },
    ])
    const many = deriveObservations([
      { kind: 'dismissed_verdict', subject: 'Lisbon' },
      { kind: 'dismissed_verdict', subject: 'Lisbon' },
      { kind: 'dismissed_verdict', subject: 'Lisbon' },
    ])
    expect(twice[0].text).toContain('more than once')
    expect(many[0].text).toContain('a few times')
  })

  it('caps the number of surfaced observations', () => {
    const rows = ['A', 'B', 'C', 'D', 'E', 'F'].flatMap((s) => [
      { kind: 'dismissed_verdict', subject: s },
      { kind: 'dismissed_verdict', subject: s },
    ])
    expect(deriveObservations(rows).length).toBeLessThanOrEqual(4)
  })

  it('empty in → empty out', () => {
    expect(deriveObservations([])).toEqual([])
  })
})

describe('OUTCOME_KINDS', () => {
  it('is the allowlist the recorder gates on', () => {
    expect(OUTCOME_KINDS).toContain('dismissed_verdict')
  })
})
