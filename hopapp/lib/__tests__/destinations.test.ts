import { describe, it, expect } from 'vitest'
import {
  destinations,
  affordableWith,
  topValue,
  computeCpp,
} from '@/lib/destinations'

describe('destinations dataset', () => {
  it('has a curated spread of ~24 destinations', () => {
    expect(destinations.length).toBeGreaterThanOrEqual(24)
  })

  it('every destination has a positive, defined cpp', () => {
    for (const d of destinations) {
      const c = computeCpp(d)
      expect(c, `${d.city} cpp`).toBeTypeOf('number')
      expect(c as number).toBeGreaterThan(0)
    }
  })
})

describe('affordableWith', () => {
  it('returns many destinations for a large balance', () => {
    const got = affordableWith(618314)
    // a big balance unlocks essentially everything
    expect(got.length).toBe(destinations.length)
    expect(got.length).toBeGreaterThanOrEqual(24)
  })

  it('excludes long-haul awards on a small balance', () => {
    const got = affordableWith(5000)
    // nothing in the set is bookable one-way for 5k miles
    expect(got.length).toBe(0)
    expect(got.some((d) => d.code === 'NRT')).toBe(false)
    expect(got.some((d) => d.code === 'SYD')).toBe(false)
  })

  it('returns only short-haul at a mid-low balance and no long-hauls', () => {
    const got = affordableWith(13000)
    expect(got.length).toBeGreaterThan(0)
    expect(got.length).toBeLessThan(destinations.length)
    // long-hauls (Tokyo, Sydney, Bali) require far more than 13k
    expect(got.some((d) => d.code === 'NRT')).toBe(false)
    expect(got.some((d) => d.code === 'SYD')).toBe(false)
    expect(got.some((d) => d.code === 'DPS')).toBe(false)
    // cheap hops are in
    expect(got.some((d) => d.code === 'YVR')).toBe(true)
    expect(got.some((d) => d.code === 'MEX')).toBe(true)
  })

  it('sorts results by cpp descending', () => {
    const got = affordableWith(618314)
    for (let i = 1; i < got.length; i++) {
      const prev = computeCpp(got[i - 1]) as number
      const cur = computeCpp(got[i]) as number
      expect(prev).toBeGreaterThanOrEqual(cur)
    }
  })
})

describe('topValue', () => {
  it('returns n destinations sorted by cpp desc', () => {
    const n = 5
    const got = topValue(n)
    expect(got.length).toBe(n)
    for (let i = 1; i < got.length; i++) {
      const prev = computeCpp(got[i - 1]) as number
      const cur = computeCpp(got[i]) as number
      expect(prev).toBeGreaterThanOrEqual(cur)
    }
  })

  it('top entry is the highest-cpp destination overall', () => {
    const best = topValue(1)[0]
    const maxCpp = Math.max(...destinations.map((d) => computeCpp(d) as number))
    expect(computeCpp(best)).toBe(maxCpp)
  })
})
