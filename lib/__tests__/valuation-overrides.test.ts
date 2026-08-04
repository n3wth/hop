import { describe, it, expect } from 'vitest'
import { getValuationOverrides, upsertValuationOverrides } from '@/lib/valuation-overrides'

// Like every owner lib, this degrades via withDb — with no Supabase configured
// in the test env, every function must resolve to its safe fallback rather than
// throw.

describe('getValuationOverrides() — degrades', () => {
  it('returns [] when the db is unconfigured', async () => {
    await expect(getValuationOverrides()).resolves.toEqual([])
  })
})

describe('upsertValuationOverrides() — degrades', () => {
  it('returns false when the db is unconfigured', async () => {
    await expect(
      upsertValuationOverrides([{ programId: 'amex-mr', cpp: 2.1, sampleSize: 25, asOf: new Date().toISOString() }]),
    ).resolves.toBe(false)
  })

  it('returns true (no-op) for an empty row list without touching the db', async () => {
    await expect(upsertValuationOverrides([])).resolves.toBe(true)
  })

  it('never throws on junk input', async () => {
    // @ts-expect-error — exercising a non-array argument at runtime
    await expect(upsertValuationOverrides(null)).resolves.toBe(false)
  })
})
