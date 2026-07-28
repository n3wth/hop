import { describe, it, expect } from 'vitest'
import {
  CONVERSATION_MEMORY_TELEMETRY,
  olderTurns,
  scrubEconomics,
  SUMMARIZE_AFTER,
  RETAIN,
  SOURCE_CAP,
} from '@/lib/conversation-memory'
import type { ConversationMessage } from '@/lib/conversations'
import { buildAgenticSystemForTest } from '@/app/api/concierge/route'

function thread(n: number): ConversationMessage[] {
  return Array.from({ length: n }, (_, i) => ({
    role: i % 2 === 0 ? ('user' as const) : ('assistant' as const),
    content: `turn ${i}`,
  }))
}

describe('olderTurns', () => {
  it('returns [] for a short thread that fits the live window', () => {
    expect(olderTurns([])).toEqual([])
    expect(olderTurns(thread(SUMMARIZE_AFTER))).toEqual([])
  })

  it('folds everything older than the retained live window', () => {
    const t = thread(SUMMARIZE_AFTER + 10)
    const older = olderTurns(t)
    expect(older.length).toBe(t.length - RETAIN)
    expect(older[0].content).toBe('turn 0') // oldest turn is included
    expect(older[older.length - 1].content).toBe(`turn ${t.length - RETAIN - 1}`)
  })

  it('caps the summarizer source to SOURCE_CAP', () => {
    const older = olderTurns(thread(SOURCE_CAP + RETAIN + 50))
    expect(older.length).toBe(SOURCE_CAP)
  })

  it('drops malformed turns before counting', () => {
    const valid = thread(SUMMARIZE_AFTER + 6)
    const mixed = [
      { role: 'system', content: 'ignore me' },
      { role: 'user', content: '   ' },
      { role: 'assistant', content: 123 },
      ...valid,
    ] as unknown as ConversationMessage[]
    expect(olderTurns(mixed)).toEqual(olderTurns(valid))
  })
})

describe('scrubEconomics', () => {
  it('strips prices, miles/points, and cpp figures (code-enforced no-economics)', () => {
    const dirty =
      'The traveler priced Tokyo at 45k miles via Virgin, about $420 cash, 3.1cpp. Also 40,000 points to Lisbon and 2.5 cents per point.'
    const clean = scrubEconomics(dirty)
    expect(clean).not.toMatch(/\$\s?\d/)
    expect(clean).not.toMatch(/\bcpp\b/i)
    expect(clean).not.toMatch(/\d[\d,]*\s?k?\s?(?:miles?|points?|pts?)/i)
    expect(clean).not.toMatch(/cents?\s?[-\s]?per[-\s]?point/i)
    // durable human context survives
    expect(clean).toContain('Tokyo')
    expect(clean).toContain('Lisbon')
  })

  it('leaves non-economic numbers (trip length, dates) alone', () => {
    const s = 'The traveler wants a 5-day trip in March, likely 2 cities.'
    expect(scrubEconomics(s)).toBe(s)
  })
})

describe('buildAgenticSystem memory block', () => {
  it('injects the durable memory as CONTEXT-ONLY when present', () => {
    const sys = buildAgenticSystemForTest(
      undefined,
      undefined,
      undefined,
      undefined,
      'the traveler is weighing Lisbon vs Tokyo and flies business',
    )
    expect(sys).toContain('weighing Lisbon vs Tokyo')
    expect(sys).toMatch(/remember from earlier/i)
    // framed as non-authoritative for numbers (engine-invariant guardrail)
    expect(sys).toMatch(/re-check live figures/i)
    // the standing "never invent numbers" discipline must co-exist with memory
    expect(sys).toMatch(/NEVER invent/i)
  })

  it('omits the memory framing when there is no summary', () => {
    const sys = buildAgenticSystemForTest(undefined, undefined, undefined, undefined, '')
    expect(sys).not.toMatch(/remember from earlier/i)
  })
})

describe('conversation memory telemetry', () => {
  it('explicitly opts the transcript summarizer out of all AI telemetry', () => {
    expect(CONVERSATION_MEMORY_TELEMETRY).toEqual({ isEnabled: false })
  })
})
