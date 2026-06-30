import { describe, it, expect } from 'vitest'
import { cardForProgram, listCardAffiliates } from '../card-affiliates'
import { canonicalizeProgram } from '../programs'

describe('cardForProgram() — canonicalization', () => {
  it('resolves canonical program names', () => {
    expect(cardForProgram('United MileagePlus')?.cardName).toBe('United Explorer Card')
    expect(cardForProgram('Amex Membership Rewards')?.issuer).toBe('American Express')
    expect(cardForProgram('Chase Ultimate Rewards')?.cardName).toBe('Chase Sapphire Preferred')
  })

  it('tolerates abbreviations and free-text (same normalizer as the engine)', () => {
    expect(cardForProgram('united')?.cardName).toBe('United Explorer Card')
    expect(cardForProgram('amex mr')?.cardName).toBe('American Express Gold Card')
    expect(cardForProgram('cap one')?.cardName).toBe('Capital One Venture X')
    // The free-text strings hop actually sees on a pick / destination.bestProgram.
    expect(cardForProgram('Alaska Atmos Rewards')?.issuer).toBe('Bank of America')
    expect(cardForProgram('British Airways Avios')?.cardName).toContain('British Airways')
  })

  it('tolerates a typo via the registry fuzzy pass', () => {
    // "skymiels" -> skymiles -> delta in canonicalizeProgram.
    expect(cardForProgram('skymiels')?.cardName).toBe('Delta SkyMiles Gold (Amex)')
  })

  it('returns undefined for unknown / empty / unmapped programs', () => {
    expect(cardForProgram('')).toBeUndefined()
    expect(cardForProgram('not a real program zzz')).toBeUndefined()
    // Hotels are intentionally unmapped (hop only verdicts flights).
    expect(canonicalizeProgram('World of Hyatt')?.id).toBe('hyatt')
    expect(cardForProgram('World of Hyatt')).toBeUndefined()
  })

  it('never throws on garbage input', () => {
    expect(() => cardForProgram('!!!')).not.toThrow()
    // @ts-expect-error — exercising a non-string at runtime
    expect(() => cardForProgram(undefined)).not.toThrow()
  })
})

describe('affiliate table integrity', () => {
  const table = listCardAffiliates()

  it('is keyed by canonical program ids', () => {
    for (const key of Object.keys(table)) {
      expect(canonicalizeProgram(key)?.id, `${key} is not a canonical id`).toBe(key)
    }
  })

  it('every card is well-formed with a hop-tracked apply URL', () => {
    for (const [id, card] of Object.entries(table)) {
      expect(card.cardName.length, id).toBeGreaterThan(0)
      expect(card.issuer.length, id).toBeGreaterThan(0)
      expect(card.earnRate.length, id).toBeGreaterThan(0)
      expect(card.note.length, id).toBeGreaterThan(0)
      expect(card.bonusMiles, id).toBeGreaterThanOrEqual(0)
      expect(card.applyUrl, id).toMatch(/^https:\/\//)
      expect(card.applyUrl, id).toContain('ref=hop-card')
    }
  })
})
