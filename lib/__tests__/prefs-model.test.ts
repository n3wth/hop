import { describe, it, expect } from 'vitest'
import {
  applyPrefs,
  validatePrefs,
  parseTravelPrefsFallback,
  cabinRank,
  isEmptyPrefs,
} from '@/lib/prefs-model'
import type { FlightOption } from '@/lib/types'

// Minimal option factory — only the fields applyPrefs reads.
function opt(id: string, over: Partial<FlightOption> = {}): FlightOption {
  return {
    id,
    kind: 'award',
    airline: id,
    route: 'SFO → NRT',
    date: 'Jul 9',
    tier: 'muted',
    bookingUrl: '#',
    ...over,
  }
}

describe('isEmptyPrefs()', () => {
  it('treats undefined/null/empty as empty', () => {
    expect(isEmptyPrefs(undefined)).toBe(true)
    expect(isEmptyPrefs(null)).toBe(true)
    expect(isEmptyPrefs({})).toBe(true)
  })
  it('treats any set field as non-empty', () => {
    expect(isEmptyPrefs({ maxStops: 1 })).toBe(false)
    expect(isEmptyPrefs({ minCabin: 'business' })).toBe(false)
    expect(isEmptyPrefs({ preferNonstop: true })).toBe(false)
  })
})

describe('cabinRank()', () => {
  it('maps free-string cabins to the enum order', () => {
    expect(cabinRank('First')).toBe(3)
    expect(cabinRank('Business')).toBe(2)
    expect(cabinRank('Premium Economy')).toBe(1)
    expect(cabinRank('Economy')).toBe(0)
    expect(cabinRank('Main')).toBe(0)
    expect(cabinRank('Saver')).toBe(0)
    expect(cabinRank(undefined)).toBeUndefined()
    expect(cabinRank('Mystery')).toBeUndefined()
  })
})

describe('applyPrefs()', () => {
  it('is a no-op on empty prefs (returns a copy, same order)', () => {
    const list = [opt('a'), opt('b')]
    const out = applyPrefs(list, {})
    expect(out.map((o) => o.id)).toEqual(['a', 'b'])
    expect(out).not.toBe(list) // new array
  })

  it('does not mutate the input array', () => {
    const list = [opt('a', { stops: 1 }), opt('b', { stops: 0 })]
    const snapshot = list.map((o) => o.id)
    applyPrefs(list, { preferNonstop: true })
    expect(list.map((o) => o.id)).toEqual(snapshot)
  })

  it('preferNonstop floats nonstop options up (tiebreaker, keeps cpp order within group)', () => {
    const list = [
      opt('a', { stops: 1 }), // best cpp but connects
      opt('b', { stops: 0 }), // nonstop
      opt('c', { stops: 1 }),
      opt('d', { stops: 0 }),
    ]
    const out = applyPrefs(list, { preferNonstop: true })
    expect(out.map((o) => o.id)).toEqual(['b', 'd', 'a', 'c'])
  })

  it('maxStops: 0 filters out options that provably connect', () => {
    const list = [
      opt('a', { stops: 0 }),
      opt('b', { stops: 1 }),
      opt('c', { stops: 2 }),
    ]
    const out = applyPrefs(list, { maxStops: 0 })
    expect(out.map((o) => o.id)).toEqual(['a'])
  })

  it('maxStops keeps options with unknown stop counts (never drop on missing data)', () => {
    const list = [opt('a', { stops: 0 }), opt('b', {} /* unknown stops */)]
    const out = applyPrefs(list, { maxStops: 0 })
    expect(out.map((o) => o.id).sort()).toEqual(['a', 'b'])
  })

  it('infers nonstop from direct:true when stops is absent', () => {
    const list = [opt('a', { direct: false, stops: 1 }), opt('b', { direct: true })]
    const out = applyPrefs(list, { maxStops: 0 })
    expect(out.map((o) => o.id)).toEqual(['b'])
  })

  it('never empties the verdict: keeps all when the filter would remove everything', () => {
    const list = [opt('a', { stops: 1 }), opt('b', { stops: 2 })]
    const out = applyPrefs(list, { maxStops: 0 })
    expect(out.map((o) => o.id).sort()).toEqual(['a', 'b'])
  })

  it('exempts cash baselines from the maxStops filter', () => {
    const list = [
      opt('award', { stops: 1 }),
      opt('cash', { kind: 'cash', stops: 1 }),
    ]
    const out = applyPrefs(list, { maxStops: 0 })
    // award (stops 1) filtered, cash kept as fallback baseline.
    expect(out.map((o) => o.id)).toEqual(['cash'])
  })

  it('minCabin sinks below-floor options to the bottom (deprioritize, not drop)', () => {
    const list = [
      opt('eco', { cabin: 'Economy' }), // best cpp, below floor
      opt('biz', { cabin: 'Business' }),
      opt('first', { cabin: 'First' }),
    ]
    const out = applyPrefs(list, { minCabin: 'business' })
    expect(out.map((o) => o.id)).toEqual(['biz', 'first', 'eco'])
    expect(out).toHaveLength(3) // nothing dropped
  })

  it('cpp order is preserved as the underlying tiebreaker within each group', () => {
    // Two business options in incoming cpp order, one economy. minCabin business.
    const list = [
      opt('eco', { cabin: 'Main' }),
      opt('biz1', { cabin: 'Business' }),
      opt('biz2', { cabin: 'Business' }),
    ]
    const out = applyPrefs(list, { minCabin: 'business' })
    expect(out.map((o) => o.id)).toEqual(['biz1', 'biz2', 'eco'])
  })

  it('composes cabin floor then nonstop together', () => {
    const list = [
      opt('a', { cabin: 'Economy', stops: 0 }), // nonstop but below cabin floor
      opt('b', { cabin: 'Business', stops: 1 }), // cabin ok, connects
      opt('c', { cabin: 'Business', stops: 0 }), // cabin ok, nonstop
    ]
    const out = applyPrefs(list, { minCabin: 'business', preferNonstop: true })
    // cabin floor dominates → c,b above a; within cabin-ok, nonstop c before b.
    expect(out.map((o) => o.id)).toEqual(['c', 'b', 'a'])
  })
})

describe('validatePrefs() — clamps untrusted input', () => {
  it('drops unknown fields entirely', () => {
    const out = validatePrefs({ maxStops: 1, evil: 'rm -rf', cabin: 'gold' })
    expect(out).toEqual({ maxStops: 1 })
  })

  it('clamps maxStops to 0..3 integers', () => {
    expect(validatePrefs({ maxStops: -5 }).maxStops).toBe(0)
    expect(validatePrefs({ maxStops: 99 }).maxStops).toBe(3)
    expect(validatePrefs({ maxStops: 1.9 }).maxStops).toBe(1)
  })

  it('rejects out-of-enum cabins', () => {
    expect(validatePrefs({ minCabin: 'first' }).minCabin).toBe('first')
    expect(validatePrefs({ minCabin: 'gold' }).minCabin).toBeUndefined()
    expect(validatePrefs({ minCabin: 'BUSINESS' }).minCabin).toBe('business')
  })

  it('maxStops 0 implies preferNonstop', () => {
    expect(validatePrefs({ maxStops: 0 }).preferNonstop).toBe(true)
  })

  it('ignores non-objects', () => {
    expect(validatePrefs(null)).toEqual({})
    expect(validatePrefs('nonstop')).toEqual({})
    expect(validatePrefs(42)).toEqual({})
  })
})

describe('parseTravelPrefsFallback() — deterministic, offline', () => {
  it('parses nonstop / direct phrasings', () => {
    for (const t of ['nonstop only', 'non-stop', 'direct flights please', 'no layovers', "I won't connect"]) {
      const p = parseTravelPrefsFallback(t)
      expect(p.maxStops, t).toBe(0)
      expect(p.preferNonstop, t).toBe(true)
    }
  })

  it('parses business / first / premium cabins', () => {
    expect(parseTravelPrefsFallback('business class to Tokyo').minCabin).toBe('business')
    expect(parseTravelPrefsFallback('first class only').minCabin).toBe('first')
    expect(parseTravelPrefsFallback('premium economy is fine').minCabin).toBe('premium')
    expect(parseTravelPrefsFallback('lie-flat seat').minCabin).toBe('business')
  })

  it('parses numeric stop ceilings', () => {
    expect(parseTravelPrefsFallback('one stop max').maxStops).toBe(1)
    expect(parseTravelPrefsFallback('at most 2 stops').maxStops).toBe(2)
  })

  it('combines cabin and nonstop', () => {
    const p = parseTravelPrefsFallback('business class, nonstop to Tokyo')
    expect(p.minCabin).toBe('business')
    expect(p.maxStops).toBe(0)
    expect(p.preferNonstop).toBe(true)
  })

  it('returns {} when nothing matches', () => {
    expect(parseTravelPrefsFallback('cheapest possible')).toEqual({})
    expect(parseTravelPrefsFallback('')).toEqual({})
  })
})
