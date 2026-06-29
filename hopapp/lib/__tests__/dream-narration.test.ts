import { describe, it, expect } from 'vitest'
import type { Balance } from '@/lib/types'
import { ledgerDream } from '@/lib/ledger-dream'
import {
  templatedBlurb,
  buildDreamPrompt,
  dreamFacts,
} from '@/lib/dream-narration'

const b = (program: string, balance: number): Balance => ({ program, code: '', balance })

describe('templatedBlurb', () => {
  it('is second-person and names the real city for a reachable transfer dream', () => {
    const dream = ledgerDream([b('Amex Membership Rewards', 120000)])
    const blurb = templatedBlurb(dream)
    expect(blurb).toContain(dream.destination.city)
    expect(blurb.toLowerCase()).toContain('you')
    // mentions the engine's transfer source (the proof), not a made-up program.
    expect(blurb).toContain(dream.proof.transferFrom!.source)
  })

  it('save-toward fallback reads as aspirational, not a booking', () => {
    const dream = ledgerDream([])
    const blurb = templatedBlurb(dream)
    expect(dream.saveToward).toBe(true)
    expect(blurb).toContain(dream.destination.city)
    expect(blurb.toLowerCase()).toMatch(/save|stack|closer/)
  })

  it('never invents a number outside the engine facts', () => {
    const dream = ledgerDream([b('Alaska Mileage Plan', 60000)])
    const blurb = templatedBlurb(dream)
    // the only $ figure is the engine cash value
    const dollars = blurb.match(/\$[\d,]+/g) ?? []
    const expected = `$${Math.round(dream.cashValue).toLocaleString('en-US')}`
    for (const d of dollars) expect(d).toBe(expected)
  })
})

describe('buildDreamPrompt', () => {
  it('feeds the model ONLY engine facts and forbids inventing numbers', () => {
    const dream = ledgerDream([b('Amex Membership Rewards', 120000)])
    const { system, user } = buildDreamPrompt(dream)
    expect(system.toLowerCase()).toContain('second person')
    expect(system.toLowerCase()).toContain('do not')
    // the facts block carries the engine's program + city
    expect(user).toContain(dream.destination.city)
    expect(user).toContain(dream.proof.program)
  })

  it('dreamFacts includes the transfer path for a transfer dream', () => {
    const dream = ledgerDream([b('Amex Membership Rewards', 120000)])
    const facts = dreamFacts(dream)
    expect(facts).toContain(dream.proof.transferFrom!.source)
    expect(facts).toContain(dream.proof.transferFrom!.ratio)
  })
})
