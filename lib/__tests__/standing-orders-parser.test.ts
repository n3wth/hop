import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { parseStandingOrder } from '@/lib/standing-orders-parser'

// Exercises the deterministic fallback path: with no AI_GATEWAY_API_KEY set,
// callGateway returns null and parseStandingOrder resolves to the regex result.
// This proves watches parse even when the AI is down.

describe('parseStandingOrder() — fallback (no gateway key)', () => {
  const original = process.env.AI_GATEWAY_API_KEY

  beforeEach(() => {
    delete process.env.AI_GATEWAY_API_KEY
  })
  afterEach(() => {
    if (original === undefined) delete process.env.AI_GATEWAY_API_KEY
    else process.env.AI_GATEWAY_API_KEY = original
  })

  it('parses a full plain-English watch with an ISO date', async () => {
    const d = await parseStandingOrder(
      'watch SFO to NRT business 2026-03-25 ping me above 2.5 cpp using points I hold',
    )
    expect(d?.params.from).toBe('SFO')
    expect(d?.params.to).toBe('NRT')
    expect(d?.params.depart).toBe('2026-03-25')
    expect(d?.minCpp).toBe(2.5)
    expect(d?.minCabin).toBe('business')
    expect(d?.eligiblePrograms).toEqual([])
  })

  it('seeds origin from the home airport', async () => {
    const d = await parseStandingOrder('watch to NRT 2026-03-25 above 3 cpp', {
      homeAirport: 'SFO',
    })
    expect(d?.params.from).toBe('SFO')
    expect(d?.params.to).toBe('NRT')
    expect(d?.minCpp).toBe(3)
  })

  it('returns null when there is no route', async () => {
    expect(await parseStandingOrder('ping me when good 2026-03-25')).toBeNull()
  })

  it('returns null for empty input', async () => {
    expect(await parseStandingOrder('')).toBeNull()
    expect(await parseStandingOrder('   ')).toBeNull()
  })

  it('never throws on odd input', async () => {
    await expect(
      parseStandingOrder('🛫 SFO to NRT 2026-03-25 above 2.5 cpp'),
    ).resolves.toBeTruthy()
  })
})
