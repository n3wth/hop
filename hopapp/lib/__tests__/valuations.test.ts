import { describe, it, expect, afterEach, vi } from 'vitest'
import {
  programValue,
  valueOfPoints,
  listValuations,
  valuationsByName,
  clampCpp,
  parseValuationJson,
  buildValuationPrompt,
  refreshValuationsViaAI,
  resetValuations,
  GENERIC_BASELINE,
  MIN_CPP,
  MAX_CPP,
  VALUATION_SOURCES,
} from '../valuations'
import { PROGRAMS, programById } from '../programs'

afterEach(() => {
  resetValuations()
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

describe('baseline table coverage', () => {
  it('prices every canonical program', () => {
    const table = listValuations()
    for (const p of PROGRAMS) {
      expect(table[p.id], `${p.id} missing from baseline`).toBeTypeOf('number')
    }
  })

  it('every baseline value is within the sane band', () => {
    for (const cpp of Object.values(listValuations())) {
      expect(cpp).toBeGreaterThanOrEqual(MIN_CPP)
      expect(cpp).toBeLessThanOrEqual(MAX_CPP)
    }
  })

  it('has named sources', () => {
    expect(VALUATION_SOURCES.length).toBeGreaterThan(0)
  })
})

describe('programValue()', () => {
  it('returns the published baseline for known programs', () => {
    expect(programValue('amex-mr')).toBe(2.0)
    expect(programValue('chase-ur')).toBe(2.05)
    expect(programValue('bilt')).toBe(2.2)
    expect(programValue('delta')).toBe(1.2)
    expect(programValue('hilton')).toBe(0.35)
  })

  it('degrades to GENERIC_BASELINE for unknown ids — never throws or undefined', () => {
    expect(programValue('not-a-program')).toBe(GENERIC_BASELINE)
    expect(programValue('')).toBe(GENERIC_BASELINE)
  })
})

describe('valueOfPoints()', () => {
  it('computes dollar value as points * cpp / 100', () => {
    // 100k Amex MR at 2.0cpp = $2000
    expect(valueOfPoints('amex-mr', 100_000)).toBe(2000)
    // 60k Chase UR at 2.05cpp = $1230
    expect(valueOfPoints('chase-ur', 60_000)).toBe(1230)
    // 50k Hilton at 0.35cpp = $175
    expect(valueOfPoints('hilton', 50_000)).toBe(175)
  })

  it('returns 0 for non-positive or invalid point counts', () => {
    expect(valueOfPoints('amex-mr', 0)).toBe(0)
    expect(valueOfPoints('amex-mr', -5)).toBe(0)
    expect(valueOfPoints('amex-mr', NaN)).toBe(0)
    expect(valueOfPoints('amex-mr', Infinity)).toBe(0)
  })

  it('uses GENERIC_BASELINE for unknown program ids', () => {
    expect(valueOfPoints('mystery', 10_000)).toBe(Math.round(10_000 * GENERIC_BASELINE) / 100)
  })
})

describe('valuationsByName()', () => {
  it('keys by canonical program name', () => {
    const byName = valuationsByName()
    expect(byName['Amex Membership Rewards']).toBe(2.0)
    expect(byName['World of Hyatt']).toBe(1.55)
    // one entry per program
    expect(Object.keys(byName).length).toBe(PROGRAMS.length)
  })
})

describe('clampCpp()', () => {
  it('clamps to the sane band', () => {
    expect(clampCpp(50)).toBe(MAX_CPP)
    expect(clampCpp(0)).toBe(MIN_CPP)
    expect(clampCpp(2.0)).toBe(2.0)
  })

  it('rounds to 2 decimals', () => {
    expect(clampCpp(1.23456)).toBe(1.23)
  })

  it('rejects non-finite / non-number input', () => {
    expect(clampCpp(NaN)).toBeNull()
    expect(clampCpp(Infinity)).toBeNull()
    expect(clampCpp('2.0')).toBeNull()
    expect(clampCpp(null)).toBeNull()
    expect(clampCpp(undefined)).toBeNull()
  })
})

describe('parseValuationJson()', () => {
  it('parses a clean JSON map and clamps values', () => {
    const out = parseValuationJson('{"amex-mr": 2.5, "delta": 1.1}')
    expect(out['amex-mr']).toBe(2.5)
    expect(out['delta']).toBe(1.1)
  })

  it('strips markdown fences', () => {
    const out = parseValuationJson('```json\n{"amex-mr": 2.0}\n```')
    expect(out['amex-mr']).toBe(2.0)
  })

  it('drops ids that are not real canonical programs', () => {
    const out = parseValuationJson('{"amex-mr": 2.0, "fake-program": 3.0}')
    expect(out['amex-mr']).toBe(2.0)
    expect(out['fake-program']).toBeUndefined()
  })

  it('clamps insane AI values into the sane band (no hallucinated 50cpp leaks)', () => {
    const out = parseValuationJson('{"amex-mr": 99, "delta": -4}')
    expect(out['amex-mr']).toBe(MAX_CPP)
    expect(out['delta']).toBe(MIN_CPP)
  })

  it('returns {} on garbage / non-JSON', () => {
    expect(parseValuationJson('not json at all')).toEqual({})
    expect(parseValuationJson('')).toEqual({})
    expect(parseValuationJson('{ broken')).toEqual({})
  })
})

describe('buildValuationPrompt()', () => {
  it('mentions the sane clamp band and every program id', () => {
    const { system, user } = buildValuationPrompt()
    expect(system).toContain(String(MIN_CPP))
    expect(system).toContain(String(MAX_CPP))
    expect(system).toContain('amex-mr')
    expect(system).toContain('JSON')
    expect(user.length).toBeGreaterThan(0)
  })
})

describe('refreshValuationsViaAI()', () => {
  it('falls back to baseline when no provider is configured — never throws', async () => {
    vi.stubEnv('AI_GATEWAY_API_KEY', '')
    vi.stubEnv('ANTHROPIC_API_KEY', '')
    vi.stubEnv('CLAUDE_CODE_OAUTH_TOKEN', '')
    const res = await refreshValuationsViaAI()
    expect(res.source).toBe('baseline')
    expect(res.updated).toEqual([])
    expect(res.valuations['amex-mr']).toBe(2.0)
  })

  it('falls back to baseline when the gateway errors — never throws', async () => {
    vi.stubEnv('AI_GATEWAY_API_KEY', 'test-key')
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network down'))
    const res = await refreshValuationsViaAI()
    expect(res.source).toBe('baseline')
    expect(res.valuations['delta']).toBe(1.2)
  })

  it('merges clamped AI values over baseline and updates the live table', async () => {
    vi.stubEnv('AI_GATEWAY_API_KEY', 'test-key')
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: '{"amex-mr": 2.4, "delta": 99}' } }],
        }),
        { status: 200 },
      ),
    )
    const res = await refreshValuationsViaAI()
    expect(res.source).toBe('ai')
    expect(res.updated.sort()).toEqual(['amex-mr', 'delta'])
    // clamped: 99 -> MAX_CPP
    expect(res.valuations['delta']).toBe(MAX_CPP)
    expect(res.valuations['amex-mr']).toBe(2.4)
    // unpriced program keeps its baseline
    expect(res.valuations['hilton']).toBe(0.35)
    // live table reflects the refresh
    expect(programValue('amex-mr')).toBe(2.4)
  })

  it('keeps baseline when AI returns no usable values', async () => {
    vi.stubEnv('AI_GATEWAY_API_KEY', 'test-key')
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({ choices: [{ message: { content: 'sorry I cannot help' } }] }),
        { status: 200 },
      ),
    )
    const res = await refreshValuationsViaAI()
    expect(res.source).toBe('baseline')
    expect(programValue('amex-mr')).toBe(2.0)
  })
})

describe('registry integration', () => {
  it('every priced id resolves to a real program', () => {
    for (const id of Object.keys(listValuations())) {
      expect(programById(id), `${id} is not a canonical program`).toBeDefined()
    }
  })
})
