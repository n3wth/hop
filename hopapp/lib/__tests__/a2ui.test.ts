import { describe, it, expect } from 'vitest'
import {
  validateBlock,
  parseA2UI,
  extractA2UIJson,
  reconcileEconomics,
  personalizeBlocks,
  a2uiGuidance,
  A2UI_BLOCK_TYPES,
  type A2UIBlock,
  type VerdictCardBlock,
  type CompareBlock,
} from '@/lib/a2ui'
import { destinationByCode, computeCpp } from '@/lib/destinations'
import type { TravelProfile } from '@/lib/travel-profile-model'

// a2ui is the agent-to-UI seam: the model emits a typed, CLOSED-union block spec
// and the CLIENT renders it on-brand. These tests prove the SAFETY MODEL —
// unknown/malformed blocks are dropped (never crash), economics are re-derived
// from the engine (never the model), and PERSONALIZATION is enforced server-side.

describe('validateBlock() — closed union, per-block validation', () => {
  it('drops a block with an unknown type (closed union)', () => {
    expect(validateBlock({ type: 'totally_made_up', foo: 1 })).toBeNull()
    expect(validateBlock({ type: 'iframe', src: 'evil' })).toBeNull()
  })

  it('drops non-objects and missing type', () => {
    expect(validateBlock(null)).toBeNull()
    expect(validateBlock('verdict_card')).toBeNull()
    expect(validateBlock(42)).toBeNull()
    expect(validateBlock({ code: 'NRT' })).toBeNull()
  })

  it('validates verdict_card and uppercases the IATA code', () => {
    const b = validateBlock({ type: 'verdict_card', code: 'nrt', reason: 'great food' })
    expect(b).toEqual({ type: 'verdict_card', code: 'NRT', reason: 'great food' })
  })

  it('drops verdict_card without the required fields', () => {
    expect(validateBlock({ type: 'verdict_card', code: 'NRT' })).toBeNull()
    expect(validateBlock({ type: 'verdict_card', reason: 'x' })).toBeNull()
  })

  it('NEVER lets the model seed econ on a verdict_card (stripped at validation)', () => {
    const b = validateBlock({
      type: 'verdict_card',
      code: 'NRT',
      reason: 'x',
      // model attempts to inject fake economics
      econ: { milesNeeded: 1, cpp: 99, verdict: 'points' },
    }) as VerdictCardBlock
    expect(b).not.toBeNull()
    expect(b.econ).toBeUndefined()
  })

  it('keeps personalization annotations on verdict_card (fitsDays, cabin)', () => {
    const b = validateBlock({
      type: 'verdict_card',
      code: 'NRT',
      reason: 'x',
      fitsDays: 10,
      cabin: 'business',
    }) as VerdictCardBlock
    expect(b.fitsDays).toBe(10)
    expect(b.cabin).toBe('business')
  })

  it('validates compare requiring both sides', () => {
    const ok = validateBlock({
      type: 'compare',
      left: { code: 'nrt', reason: 'a' },
      right: { code: 'lis', reason: 'b' },
    }) as CompareBlock
    expect(ok.left.code).toBe('NRT')
    expect(ok.right.code).toBe('LIS')
    expect(validateBlock({ type: 'compare', left: { code: 'NRT', reason: 'a' } })).toBeNull()
  })

  it('validates timing, dropping weeks with bad levels and requiring at least one', () => {
    const b = validateBlock({
      type: 'timing',
      place: 'Tokyo',
      weeks: [
        { label: 'Mar 3', level: 'low' },
        { label: 'Mar 10', level: 'nope' }, // dropped
        { label: 'Mar 17', level: 'high' },
      ],
    })
    expect(b).not.toBeNull()
    if (b && b.type === 'timing') {
      expect(b.weeks).toHaveLength(2)
      expect(b.weeks.map((w) => w.level)).toEqual(['low', 'high'])
    }
    // No valid weeks → null.
    expect(validateBlock({ type: 'timing', place: 'X', weeks: [{ label: 'a', level: 'bad' }] })).toBeNull()
  })

  it('validates weather and passes through temps', () => {
    const b = validateBlock({
      type: 'weather',
      place: 'Lisbon',
      month: 'July',
      highC: 28,
      lowC: 18,
      summary: 'warm and dry',
    })
    expect(b).toEqual({ type: 'weather', place: 'Lisbon', month: 'July', highC: 28, lowC: 18, summary: 'warm and dry' })
  })

  it('web_note requires a source and rejects non-http(s) urls (no javascript:)', () => {
    expect(validateBlock({ type: 'web_note', text: 'x' })).toBeNull()
    const safe = validateBlock({ type: 'web_note', text: 'x', source: 'timeout.com', url: 'https://timeout.com' })
    expect(safe).toMatchObject({ url: 'https://timeout.com' })
    const unsafe = validateBlock({
      type: 'web_note',
      text: 'x',
      source: 'evil',
      url: 'javascript:alert(1)',
    })
    expect(unsafe).not.toBeNull()
    if (unsafe && unsafe.type === 'web_note') expect(unsafe.url).toBeUndefined()
  })

  it('prompt_chips requires at least one chip and caps the list', () => {
    expect(validateBlock({ type: 'prompt_chips', chips: [] })).toBeNull()
    const many = Array.from({ length: 20 }, (_, i) => `chip ${i}`)
    const b = validateBlock({ type: 'prompt_chips', chips: many })
    if (b && b.type === 'prompt_chips') expect(b.chips.length).toBeLessThanOrEqual(6)
  })

  it('profile_confirm requires a fact; connect_gmail is allowed bare', () => {
    expect(validateBlock({ type: 'profile_confirm' })).toBeNull()
    expect(validateBlock({ type: 'profile_confirm', fact: 'You travel as a family' })).toMatchObject({
      fact: 'You travel as a family',
    })
    expect(validateBlock({ type: 'connect_gmail' })).toEqual({ type: 'connect_gmail' })
  })

  it('every declared union type has a working validator', () => {
    // A minimal valid example per type so the switch never silently drops one.
    const samples: Record<string, unknown> = {
      verdict_card: { type: 'verdict_card', code: 'NRT', reason: 'x' },
      compare: { type: 'compare', left: { code: 'NRT', reason: 'a' }, right: { code: 'LIS', reason: 'b' } },
      timing: { type: 'timing', place: 'X', weeks: [{ label: 'w', level: 'low' }] },
      weather: { type: 'weather', place: 'X', month: 'July', summary: 's' },
      web_note: { type: 'web_note', text: 't', source: 'src' },
      prompt_chips: { type: 'prompt_chips', chips: ['a'] },
      profile_confirm: { type: 'profile_confirm', fact: 'f' },
      connect_gmail: { type: 'connect_gmail' },
    }
    for (const t of A2UI_BLOCK_TYPES) {
      expect(validateBlock(samples[t])).not.toBeNull()
    }
  })
})

describe('parseA2UI() — top-level parse, never throws', () => {
  it('drops unknown/malformed blocks but keeps valid ones', () => {
    const out = parseA2UI({
      blocks: [
        { type: 'verdict_card', code: 'NRT', reason: 'x' },
        { type: 'evil', html: '<script>' }, // dropped
        null, // dropped
        { type: 'prompt_chips', chips: ['more like this'] },
      ],
    })
    expect(out.map((b) => b.type)).toEqual(['verdict_card', 'prompt_chips'])
  })

  it('accepts a bare array or a {blocks} object', () => {
    const arr = parseA2UI([{ type: 'connect_gmail' }])
    const obj = parseA2UI({ blocks: [{ type: 'connect_gmail' }] })
    expect(arr).toEqual(obj)
  })

  it('returns [] for garbage and never throws', () => {
    expect(parseA2UI('nope')).toEqual([])
    expect(parseA2UI(null)).toEqual([])
    expect(parseA2UI(42)).toEqual([])
    expect(parseA2UI({})).toEqual([])
  })

  it('caps the number of blocks', () => {
    const many = Array.from({ length: 30 }, () => ({ type: 'connect_gmail' }))
    expect(parseA2UI(many).length).toBeLessThanOrEqual(8)
  })
})

describe('extractA2UIJson() — pull spec from model text', () => {
  it('extracts a fenced json object embedded in prose', () => {
    const text = 'Here are ideas.\n```json\n{"blocks":[{"type":"connect_gmail"}]}\n```'
    const raw = extractA2UIJson(text)
    expect(parseA2UI(raw)).toEqual([{ type: 'connect_gmail' }])
  })

  it('handles braces inside strings without breaking balance', () => {
    const text = '```json\n{"blocks":[{"type":"web_note","text":"use { and }","source":"x"}]}\n```'
    const raw = extractA2UIJson(text)
    const blocks = parseA2UI(raw)
    expect(blocks).toHaveLength(1)
  })

  it('returns null when there is no json', () => {
    expect(extractA2UIJson('just prose, no spec')).toBeNull()
  })
})

describe('reconcileEconomics() — engine is the source of truth', () => {
  it('stamps verdict_card econ from the engine, ignoring any model value', () => {
    const d = destinationByCode('NRT')!
    const blocks: A2UIBlock[] = [{ type: 'verdict_card', code: 'NRT', reason: 'x' }]
    const [out] = reconcileEconomics(blocks, []) as VerdictCardBlock[]
    expect(out.econ).toBeDefined()
    expect(out.econ!.milesNeeded).toBe(d.typicalAwardMiles)
    expect(out.econ!.cpp).toBe(computeCpp(d))
    expect(out.econ!.bestProgram).toBe(d.bestProgram)
  })

  it('reflects the user balances in affordability/verdict', () => {
    const d = destinationByCode('NRT')!
    const rich = reconcileEconomics(
      [{ type: 'verdict_card', code: 'NRT', reason: 'x' }],
      [{ program: 'ANA Mileage Club', balance: d.typicalAwardMiles + 5000 }],
    ) as VerdictCardBlock[]
    expect(rich[0].econ!.affordable).toBe(true)

    const broke = reconcileEconomics(
      [{ type: 'verdict_card', code: 'NRT', reason: 'x' }],
      [{ program: 'Amex MR', balance: 1000 }],
    ) as VerdictCardBlock[]
    expect(broke[0].econ!.affordable).toBe(false)
    expect(broke[0].econ!.verdict).toBe('save')
  })

  it('stamps both sides of a compare and leaves econ undefined for unknown codes', () => {
    const out = reconcileEconomics(
      [
        {
          type: 'compare',
          left: { code: 'NRT', reason: 'a' },
          right: { code: 'ZZZ', reason: 'b' }, // not in dataset
        },
      ],
      [],
    ) as CompareBlock[]
    expect(out[0].left.econ).toBeDefined()
    expect(out[0].right.econ).toBeUndefined()
  })

  it('leaves non-economic blocks untouched', () => {
    const blocks: A2UIBlock[] = [{ type: 'prompt_chips', chips: ['a'] }]
    expect(reconcileEconomics(blocks, [])).toEqual(blocks)
  })
})

describe('personalizeBlocks() — same question, different blocks per user', () => {
  const torn: A2UIBlock[] = [{ type: 'verdict_card', code: 'NRT', reason: 'x', fitsDays: 10, cabin: 'business' }]

  it('drops "fits N days" when vacation days are unknown', () => {
    const out = personalizeBlocks(torn, {}, false) as VerdictCardBlock[]
    expect(out[0].fitsDays).toBeUndefined()
  })

  it('re-stamps fitsDays from the profile (model cannot claim a wrong number)', () => {
    const profile: TravelProfile = { vacationDays: 14 }
    const out = personalizeBlocks(
      [{ type: 'verdict_card', code: 'NRT', reason: 'x', fitsDays: 999 }],
      profile,
      false,
    ) as VerdictCardBlock[]
    expect(out[0].fitsDays).toBe(14)
  })

  it('only surfaces cabin when the user flies premium', () => {
    const econ: TravelProfile = { cabin: 'economy' }
    const out = personalizeBlocks(torn, econ, false) as VerdictCardBlock[]
    expect(out[0].cabin).toBeUndefined()

    const biz: TravelProfile = { cabin: 'business' }
    const out2 = personalizeBlocks(torn, biz, false) as VerdictCardBlock[]
    expect(out2[0].cabin).toBe('business')
  })

  it('drops connect_gmail when history is already connected', () => {
    const blocks: A2UIBlock[] = [{ type: 'connect_gmail' }]
    expect(personalizeBlocks(blocks, {}, true)).toEqual([])
    expect(personalizeBlocks(blocks, {}, false)).toEqual(blocks)
  })

  it('is pure — does not mutate the input blocks', () => {
    const input: A2UIBlock[] = [{ type: 'verdict_card', code: 'NRT', reason: 'x', cabin: 'first' }]
    const snapshot = JSON.parse(JSON.stringify(input))
    personalizeBlocks(input, {}, false)
    expect(input).toEqual(snapshot)
  })
})

describe('a2uiGuidance() — prompt-side personalization rules', () => {
  it('mentions vacation days when known so the model can set fitsDays', () => {
    const g = a2uiGuidance({ vacationDays: 12 }, false)
    expect(g).toContain('12 vacation days')
  })

  it('nudges connect_gmail when no history is connected, not when connected', () => {
    expect(a2uiGuidance({}, false).toLowerCase()).toContain('connect_gmail')
    expect(a2uiGuidance({}, true)).not.toContain('emit a connect_gmail block')
  })

  it('surfaces cabin only for premium cabins', () => {
    expect(a2uiGuidance({ cabin: 'business' }, true)).toContain('flies business')
    expect(a2uiGuidance({ cabin: 'economy' }, true)).not.toContain('flies economy')
  })

  it('lists every legal block type so the model knows the closed union', () => {
    const g = a2uiGuidance(undefined, true)
    for (const t of A2UI_BLOCK_TYPES) expect(g).toContain(t)
  })
})
