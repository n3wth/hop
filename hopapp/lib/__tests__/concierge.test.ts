import { describe, it, expect } from 'vitest'
import {
  buildPrompt,
  destinationsSummary,
  parseConciergeJson,
  type ConciergeContext,
} from '@/app/api/concierge/route'
import { destinations } from '@/lib/destinations'

// These tests exercise the pure prompt-assembly + parsing helpers only.
// They never construct an Anthropic client or hit the network.

describe('destinationsSummary()', () => {
  it('includes every destination by IATA code and city', () => {
    const summary = destinationsSummary()
    for (const d of destinations) {
      expect(summary).toContain(d.code)
      expect(summary).toContain(d.city)
    }
  })

  it('frames award cost without inventing live flight prices', () => {
    const summary = destinationsSummary()
    // Uses the dataset award-miles figure, expressed in "k mi ow".
    expect(summary).toMatch(/~\d+k mi ow/)
  })
})

describe('buildPrompt()', () => {
  const context: ConciergeContext = {
    programs: [
      { program: 'Amex MR', balance: 60000 },
      { program: 'Chase UR', balance: 25000 },
    ],
    totalPoints: 85000,
  }

  it('puts the user question in the user turn', () => {
    const { user } = buildPrompt('somewhere warm for a long weekend', context)
    expect(user).toBe('somewhere warm for a long weekend')
  })

  it('falls back to a default question when blank', () => {
    const { user } = buildPrompt('   ')
    expect(user.length).toBeGreaterThan(0)
  })

  it('embeds the user balances in the system prompt', () => {
    const { system } = buildPrompt('where to?', context)
    expect(system).toContain('Amex MR')
    expect(system).toContain('60,000')
    expect(system).toContain('Chase UR')
    expect(system).toContain('85,000')
  })

  it('embeds the destinations dataset in the system prompt', () => {
    const { system } = buildPrompt('where to?', context)
    // A few representative destination codes/cities must be present.
    expect(system).toContain('NRT')
    expect(system).toContain('Tokyo')
    expect(system).toContain('LIS')
    expect(system).toContain('Lisbon')
    // And the full summary should be embedded verbatim.
    expect(system).toContain(destinationsSummary())
  })

  it('embeds points valuations for points-vs-cash reasoning', () => {
    const { system } = buildPrompt('points or cash?', context)
    expect(system).toContain('Amex MR 2.0cpp')
    expect(system).toContain('Alaska 1.8cpp')
  })

  it('instructs the model to return JSON and never hallucinate prices', () => {
    const { system } = buildPrompt('where to?', context)
    expect(system).toContain('JSON')
    expect(system.toLowerCase()).toContain('never invent specific flight prices')
  })

  it('handles missing context gracefully', () => {
    const { system } = buildPrompt('inspire me')
    expect(system).toContain('No balances shared')
    // Dataset is still present even with no balances.
    expect(system).toContain('NRT')
  })
})

describe('parseConciergeJson()', () => {
  it('parses a clean JSON object', () => {
    const out = parseConciergeJson(
      '{"answer":"Go to Tokyo","suggestions":[{"code":"NRT","city":"Tokyo","reason":"great value"}]}',
    )
    expect(out.answer).toBe('Go to Tokyo')
    expect(out.suggestions?.[0].code).toBe('NRT')
  })

  it('strips markdown fences', () => {
    const out = parseConciergeJson('```json\n{"answer":"Lisbon awaits"}\n```')
    expect(out.answer).toBe('Lisbon awaits')
    expect(out.suggestions).toBeUndefined()
  })

  it('falls back to raw text when JSON is unparseable', () => {
    const out = parseConciergeJson('just some prose, no json here')
    expect(out.answer).toContain('just some prose')
  })

  it('drops malformed suggestion entries', () => {
    const out = parseConciergeJson(
      '{"answer":"hi","suggestions":[{"code":"NRT"},{"code":"LIS","city":"Lisbon","reason":"ok"}]}',
    )
    expect(out.suggestions).toHaveLength(1)
    expect(out.suggestions?.[0].code).toBe('LIS')
  })
})
