import { describe, it, expect } from 'vitest'
import {
  cardForProgram,
  cardById,
  cardOutclickPath,
  listCardAffiliates,
  formatBonus,
} from '../card-affiliates'
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
})

describe('cardById()', () => {
  it('finds cards by direct table key', () => {
    expect(cardById('amex-mr')?.cardName).toBe('American Express Gold Card')
    expect(cardById('chase-ur')?.cardName).toBe('Chase Sapphire Preferred')
    expect(cardById('united')?.cardName).toBe('United Explorer Card')
  })

  it('is case- and whitespace-insensitive', () => {
    expect(cardById('  AMEX-MR  ')?.cardName).toBe('American Express Gold Card')
  })

  it('returns undefined for unknown keys', () => {
    expect(cardById('unknown-key')).toBeUndefined()
    expect(cardById('')).toBeUndefined()
  })
})

describe('cardOutclickPath()', () => {
  it('constructs /api/go/card/[id] path', () => {
    expect(cardOutclickPath({ id: 'amex-mr' })).toBe('/api/go/card/amex-mr')
    expect(cardOutclickPath({ id: 'chase-ur' })).toBe('/api/go/card/chase-ur')
  })
})

describe('listCardAffiliates()', () => {
  it('returns sorted array of all affiliate cards', () => {
    const list = listCardAffiliates()
    expect(list.length).toBeGreaterThan(10)
    // Verify sorted by issuer then cardName
    for (let i = 1; i < list.length; i++) {
      const prev = list[i - 1]
      const curr = list[i]
      const issuerCmp = prev.issuer.localeCompare(curr.issuer)
      if (issuerCmp === 0) {
        expect(prev.cardName.localeCompare(curr.cardName)).toBeLessThanOrEqual(0)
      } else {
        expect(issuerCmp).toBeLessThan(0)
      }
    }
  })
})

describe('formatBonus()', () => {
  it('formats standard bonus with spend and months', () => {
    expect(formatBonus({ bonusMiles: 60000, bonusSpend: 6000, bonusMonths: 6 })).toBe(
      '60,000 points after $6,000 spend in 6 months'
    )
  })

  it('formats singular month correctly', () => {
    expect(formatBonus({ bonusMiles: 10000, bonusSpend: 1000, bonusMonths: 1 })).toBe(
      '10,000 points after $1,000 spend in 1 month'
    )
  })

  it('formats bonus without months', () => {
    expect(formatBonus({ bonusMiles: 5000, bonusSpend: 500, bonusMonths: 0 })).toBe(
      '5,000 points after $500 spend'
    )
  })

  it('formats bonus without spend or months', () => {
    expect(formatBonus({ bonusMiles: 5000, bonusSpend: 0, bonusMonths: 0 })).toBe('5,000 points')
  })

  it('handles zero bonus', () => {
    expect(formatBonus({ bonusMiles: 0, bonusSpend: 0, bonusMonths: 0 })).toBe('No welcome bonus')
  })
})
