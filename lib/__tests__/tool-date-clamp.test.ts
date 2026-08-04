// Regression: LLM-driven tool paths (concierge search_flights, MCP verdict)
// must clamp past/year-less dates before they reach the engine. The model
// resolved "August 12-19" into a past year and Duffel 422'd EVERY call — the
// first prod bug the degradation telemetry caught (search_degraded SEA-FCO
// "Duffel responded 422", 2026-07-05). /api/search already clamped; these
// paths didn't.
import { beforeEach, afterEach, describe, expect, it } from 'vitest'
import { buildConciergeTools } from '@/lib/concierge-tools'
import { runVerdict } from '@/lib/mcp-tools'
import { todayISO } from '@/lib/travel-dates'

const PAST = { depart: '2024-08-12', return: '2024-08-19' }

describe('LLM tool date clamping', () => {
  beforeEach(() => {
    process.env.MOCK = '1'
  })
  afterEach(() => {
    delete process.env.MOCK
  })

  it('concierge search_flights clamps past dates instead of 422ing', async () => {
    const tools = buildConciergeTools([])
    const result = (await tools.search_flights.execute!(
      { from: 'SEA', to: 'FCO', ...PAST, adults: 1 },
      { toolCallId: 't', messages: [], context: undefined } as never,
    )) as { depart: string; degraded: string[] }
    expect(result.depart >= todayISO()).toBe(true)
    // Mock engine path — a clamped date yields a priced result, not a degrade.
    expect(result.degraded).toEqual([])
  })

  it('MCP verdict clamps past dates the same way', async () => {
    const result = await runVerdict({ from: 'SEA', to: 'FCO', ...PAST, adults: 1 })
    expect(result.depart >= todayISO()).toBe(true)
  })
})
