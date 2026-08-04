import { describe, it, expect } from 'vitest'
import {
  POINTS_BANDS,
  isPointsBand,
  pointsBandSlug,
  parsePointsBand,
  formatPointsLabel,
  formatPointsCompact,
  neighborBands,
  pointsBandSearchHref,
} from '@/lib/points-bands'

describe('POINTS_BANDS', () => {
  it('is a non-empty, strictly ascending, deduped list of positive integers', () => {
    expect(POINTS_BANDS.length).toBeGreaterThanOrEqual(6)
    for (let i = 0; i < POINTS_BANDS.length; i++) {
      expect(Number.isInteger(POINTS_BANDS[i])).toBe(true)
      expect(POINTS_BANDS[i]).toBeGreaterThan(0)
      if (i > 0) expect(POINTS_BANDS[i]).toBeGreaterThan(POINTS_BANDS[i - 1])
    }
    expect(new Set(POINTS_BANDS).size).toBe(POINTS_BANDS.length)
  })
})

describe('isPointsBand', () => {
  it('is true for every curated band', () => {
    for (const band of POINTS_BANDS) expect(isPointsBand(band)).toBe(true)
  })

  it('is false for values not in the curated list', () => {
    expect(isPointsBand(100)).toBe(false)
    expect(isPointsBand(100001)).toBe(false)
    expect(isPointsBand(0)).toBe(false)
    expect(isPointsBand(-25000)).toBe(false)
  })
})

describe('pointsBandSlug + parsePointsBand', () => {
  it('round-trips every curated band through its slug', () => {
    for (const band of POINTS_BANDS) {
      expect(parsePointsBand(pointsBandSlug(band))).toBe(band)
    }
  })

  it('rejects non-band numbers even when numerically plausible', () => {
    expect(parsePointsBand('100001')).toBeUndefined()
    expect(parsePointsBand('0')).toBeUndefined()
  })

  it('rejects lookalike strings instead of coercing them', () => {
    expect(parsePointsBand('0100000')).toBeUndefined()
    expect(parsePointsBand('1e5')).toBeUndefined()
    expect(parsePointsBand('100,000')).toBeUndefined()
    expect(parsePointsBand('100000 ')).toBeUndefined()
    expect(parsePointsBand('')).toBeUndefined()
    expect(parsePointsBand('abc')).toBeUndefined()
  })
})

describe('formatPointsLabel', () => {
  it('adds thousands separators', () => {
    expect(formatPointsLabel(100000)).toBe('100,000')
    expect(formatPointsLabel(25000)).toBe('25,000')
    expect(formatPointsLabel(500000)).toBe('500,000')
  })
})

describe('formatPointsCompact', () => {
  it('renders curated bands as whole-K figures', () => {
    expect(formatPointsCompact(25000)).toBe('25K')
    expect(formatPointsCompact(100000)).toBe('100K')
    expect(formatPointsCompact(500000)).toBe('500K')
  })

  it('keeps one decimal place for a non-round thousand', () => {
    expect(formatPointsCompact(37500)).toBe('37.5K')
  })
})

describe('neighborBands', () => {
  it('has no prev at the first band and no next at the last band', () => {
    expect(neighborBands(POINTS_BANDS[0])).toEqual({ next: POINTS_BANDS[1] })
    const last = POINTS_BANDS[POINTS_BANDS.length - 1]
    const secondLast = POINTS_BANDS[POINTS_BANDS.length - 2]
    expect(neighborBands(last)).toEqual({ prev: secondLast })
  })

  it('returns both neighbors for a band in the middle', () => {
    const idx = Math.floor(POINTS_BANDS.length / 2)
    const { prev, next } = neighborBands(POINTS_BANDS[idx])
    expect(prev).toBe(POINTS_BANDS[idx - 1])
    expect(next).toBe(POINTS_BANDS[idx + 1])
  })

  it('returns an empty object for a value that is not a curated band', () => {
    expect(neighborBands(12345)).toEqual({})
  })
})

describe('pointsBandSearchHref', () => {
  it('uses the evergreen request-time search date contract', () => {
    const href = pointsBandSearchHref('NRT')
    const url = new URL(href, 'https://example.com')

    expect(url.pathname).toBe('/search')
    expect(Object.fromEntries(url.searchParams)).toEqual({
      from: 'SFO',
      to: 'NRT',
      departIn: '21',
      returnIn: '28',
      adults: '1',
    })
    expect(url.searchParams.has('depart')).toBe(false)
    expect(url.searchParams.has('return')).toBe(false)
    expect(url.searchParams.has('ret')).toBe(false)
  })
})
