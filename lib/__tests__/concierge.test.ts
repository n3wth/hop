import { describe, it, expect } from 'vitest'
import {
  buildPrompt,
  destinationsSummary,
  parseConciergeJson,
  blocksFromText,
  stripA2UIFence,
  sanitizeProse,
  type ConciergeContext,
} from '@/app/api/concierge/route'
import { destinations, destinationByCode } from '@/lib/destinations'
import type { VerdictCardBlock } from '@/lib/a2ui'

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

  it('embeds points valuations (from lib/valuations.ts) for points-vs-cash reasoning', () => {
    const { system } = buildPrompt('points or cash?', context)
    // Now sourced from the canonical valuation table (full program names, 2dp).
    expect(system).toContain('Amex Membership Rewards 2.00cpp')
    expect(system).toContain('Alaska Mileage Plan 1.40cpp')
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

  it('injects the engine-computed wallet dollar total and forbids the model from computing its own', () => {
    const { system } = buildPrompt('what is my whole wallet worth?', context)
    // lib/valuations#walletValue: 60000 * 2.00cpp + 25000 * 2.05cpp = $1,713 (rounded)
    expect(system).toContain('Engine-computed wallet dollar value')
    expect(system).toContain('$1,713')
    expect(system.toLowerCase()).toContain('never sum or multiply')
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

// The a2ui pipeline wired into the route: extract the model's fenced spec,
// validate the closed union, stamp engine economics, enforce personalization,
// and strip the fence from the user-visible prose. Pure — no network.
describe('blocksFromText() — route a2ui pipeline', () => {
  const fenced = (obj: unknown) => '```json\n' + JSON.stringify(obj) + '\n```'

  it('extracts, validates, and stamps engine economics onto verdict_card', () => {
    const d = destinationByCode('NRT')!
    const text =
      'Tokyo is a great call.\n' +
      fenced({ blocks: [{ type: 'verdict_card', code: 'NRT', reason: 'neon nights' }] })
    const blocks = blocksFromText(text, [], {}, false) as VerdictCardBlock[]
    expect(blocks).toHaveLength(1)
    expect(blocks[0].econ?.milesNeeded).toBe(d.typicalAwardMiles)
  })

  it('drops unknown block types from the model (closed union)', () => {
    const text = fenced({
      blocks: [
        { type: 'verdict_card', code: 'NRT', reason: 'x' },
        { type: 'iframe', src: 'http://evil' },
      ],
    })
    const blocks = blocksFromText(text, [], {}, false)
    expect(blocks.map((b) => b.type)).toEqual(['verdict_card'])
  })

  it('enforces personalization: no fitsDays without known vacation days', () => {
    const text = fenced({ blocks: [{ type: 'verdict_card', code: 'NRT', reason: 'x', fitsDays: 10 }] })
    const blocks = blocksFromText(text, [], {}, false) as VerdictCardBlock[]
    expect(blocks[0].fitsDays).toBeUndefined()
    const withDays = blocksFromText(text, [], { vacationDays: 21 }, false) as VerdictCardBlock[]
    expect(withDays[0].fitsDays).toBe(21)
  })

  it('returns [] when the model emitted no spec', () => {
    expect(blocksFromText('just prose', [], {}, false)).toEqual([])
  })
})

describe('stripA2UIFence() — clean prose for the user + persisted thread', () => {
  it('removes a trailing a2ui json fence', () => {
    const text = 'Go to Tokyo.\n```json\n{"blocks":[{"type":"connect_gmail"}]}\n```'
    expect(stripA2UIFence(text)).toBe('Go to Tokyo.')
  })

  it('leaves prose without a fence untouched', () => {
    expect(stripA2UIFence('Just a normal answer.')).toBe('Just a normal answer.')
  })

  it('does not strip a non-a2ui code fence', () => {
    const text = 'Here is code:\n```js\nconst x = 1\n```'
    expect(stripA2UIFence(text)).toBe(text)
  })

  it('strips an a2ui fence even when text follows it (not only at EOF)', () => {
    // The server appends the sentinel + envelope AFTER the fence, so the fence is
    // not at the end of the string — it must still be removed.
    const text =
      'Go to Tokyo.\n```json\n{"blocks":[{"type":"connect_gmail"}]}\n```\ntrailing note'
    expect(stripA2UIFence(text)).toBe('Go to Tokyo.')
  })

  it('removes the LAST a2ui fence when more than one is present', () => {
    const text =
      'Intro.\n```json\n{"blocks":[{"type":"connect_gmail"}]}\n```\nmore\n' +
      '```json\n{"blocks":[{"type":"prompt_chips","chips":["a"]}]}\n```'
    expect(stripA2UIFence(text)).toBe(
      'Intro.\n```json\n{"blocks":[{"type":"connect_gmail"}]}\n```\nmore',
    )
  })

  it('suppresses an UNCLOSED fence so a partial spec never shows as a code dump', () => {
    const text = 'Go to Tokyo.\n```json\n{"blocks":[{"type":"connect_gmail"'
    expect(stripA2UIFence(text)).toBe('Go to Tokyo.')
  })
})

describe('sanitizeProse() — keeps load-bearing figures from being struck out', () => {
  it('rewrites a leading tilde before a number/$ to "about " (avoids GFM strikethrough)', () => {
    expect(sanitizeProse('~22,500 miles or ~$340 cash, ~40k points')).toBe(
      'about 22,500 miles or about $340 cash, about 40k points',
    )
  })

  it('leaves a tilde not followed by a digit/$ untouched', () => {
    expect(sanitizeProse('roughly ~ten days')).toBe('roughly ~ten days')
  })

  it('is total/safe on empty + non-strings', () => {
    expect(sanitizeProse('')).toBe('')
    // @ts-expect-error — defensive: non-string input
    expect(sanitizeProse(undefined)).toBe('')
  })
})
