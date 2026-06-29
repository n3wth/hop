import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { parseTravelPrefs } from '@/lib/prefs-parser'

// These tests exercise the deterministic fallback path: with no AI_GATEWAY_API_KEY
// set, callGateway returns null and parseTravelPrefs resolves to the regex result.
// This proves prefs work even when the AI is down.

describe('parseTravelPrefs() — fallback (no gateway key)', () => {
  const original = process.env.AI_GATEWAY_API_KEY

  beforeEach(() => {
    delete process.env.AI_GATEWAY_API_KEY
  })
  afterEach(() => {
    if (original === undefined) delete process.env.AI_GATEWAY_API_KEY
    else process.env.AI_GATEWAY_API_KEY = original
  })

  it('translates "nonstop only" to maxStops 0 + preferNonstop', async () => {
    const p = await parseTravelPrefs('nonstop only')
    expect(p).toEqual({ maxStops: 0, preferNonstop: true })
  })

  it('translates "business class to Tokyo"', async () => {
    const p = await parseTravelPrefs('business class to Tokyo')
    expect(p.minCabin).toBe('business')
  })

  it('translates "first class, nonstop"', async () => {
    const p = await parseTravelPrefs('first class, nonstop')
    expect(p.minCabin).toBe('first')
    expect(p.maxStops).toBe(0)
    expect(p.preferNonstop).toBe(true)
  })

  it('returns {} for empty input without calling anything', async () => {
    expect(await parseTravelPrefs('')).toEqual({})
    expect(await parseTravelPrefs('   ')).toEqual({})
  })

  it('returns {} for text with no recognizable constraint', async () => {
    expect(await parseTravelPrefs('cheapest possible')).toEqual({})
  })

  it('never throws on odd input', async () => {
    await expect(parseTravelPrefs('🛫✈️ no layovers')).resolves.toEqual({
      maxStops: 0,
      preferNonstop: true,
    })
  })
})
