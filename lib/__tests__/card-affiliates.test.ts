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

  it('never throws on garbage input', () => {
    expect(() => cardForProgram('!!!')).not.toThrow()
    // @ts-expect-error — exercising a non-string at runtime
    expect(() => cardForProgram(undefined)).not.toThrow()
  })
})

describe('cardById() — exact id lookup for the outclick redirect', () => {
  it('resolves a known canonical id', () => {
    expect(cardById('chase-ur')?.cardName).toBe('Chase Sapphire Preferred')
    expect(cardById('united')?.id).toBe('united')
  })

  it('is exact — free text is NOT canonicalized (ids come from hrefs we minted)', () => {
    expect(cardById('United MileagePlus')).toBeUndefined()
    expect(cardById('CHASE-UR')).toBeUndefined()
  })

  it('returns undefined for unknown/empty ids, never throws', () => {
    expect(cardById('')).toBeUndefined()
    expect(cardById('not-a-card')).toBeUndefined()
    // @ts-expect-error — exercising a non-string at runtime
    expect(() => cardById(undefined)).not.toThrow()
  })
})

describe('cardOutclickPath() — the CTA href → redirect route contract', () => {
  it('builds the /api/go/card path with the program as query context', () => {
    expect(cardOutclickPath('chase-ur', 'Chase Ultimate Rewards')).toBe(
      '/api/go/card/chase-ur?program=Chase%20Ultimate%20Rewards',
    )
  })

  it('omits the query when there is no program context', () => {
    expect(cardOutclickPath('united')).toBe('/api/go/card/united')
    expect(cardOutclickPath('united', '')).toBe('/api/go/card/united')
    expect(cardOutclickPath('united', '   ')).toBe('/api/go/card/united')
  })

  it('URL-encodes hostile input instead of letting it shape the path', () => {
    expect(cardOutclickPath('a/b?x', 'p&q=1')).toBe('/api/go/card/a%2Fb%3Fx?program=p%26q%3D1')
  })

  it('round-trips: every table id builds a path whose id segment resolves via cardById', () => {
    for (const id of Object.keys(listCardAffiliates())) {
      const path = cardOutclickPath(id, 'ctx')
      const seg = decodeURIComponent(path.slice('/api/go/card/'.length).split('?')[0])
      expect(cardById(seg)?.id, id).toBe(id)
    }
  })
})

describe('affiliate table integrity', () => {
  const table = listCardAffiliates()

  it('is keyed by canonical program ids', () => {
    for (const key of Object.keys(table)) {
      expect(canonicalizeProgram(key)?.id, `${key} is not a canonical id`).toBe(key)
    }
  })

  it('every card carries its own table key as its id (derived, cannot drift)', () => {
    for (const [key, card] of Object.entries(table)) {
      expect(card.id, key).toBe(key)
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

  it('every card carries a plain-string annual fee from the issuer page', () => {
    for (const [id, card] of Object.entries(table)) {
      expect(card.annualFee.length, id).toBeGreaterThan(0)
      expect(typeof card.annualFee, id).toBe('string')
    }
  })
})

describe('formatBonus() — renders the standard bonus shape from raw fields', () => {
  it('renders "N points after $X spend in Y months" when all fields are present', () => {
    expect(formatBonus({ bonusMiles: 60000, bonusSpend: 4000, bonusMonths: 3 })).toBe(
      '60,000 points after $4,000 spend in 3 months',
    )
  })

  it('singularizes a 1-month window', () => {
    expect(formatBonus({ bonusMiles: 10000, bonusSpend: 500, bonusMonths: 1 })).toBe(
      '10,000 points after $500 spend in 1 month',
    )
  })

  it('drops the spend clause when there is no minimum spend', () => {
    expect(formatBonus({ bonusMiles: 5000 })).toBe('5,000 points')
  })

  it('drops the months clause when bonusMonths is omitted', () => {
    expect(formatBonus({ bonusMiles: 5000, bonusSpend: 1000 })).toBe('5,000 points after $1,000 spend')
  })

  it('reports no welcome bonus when bonusMiles is zero', () => {
    expect(formatBonus({ bonusMiles: 0, bonusSpend: 1000, bonusMonths: 3 })).toBe('No welcome bonus')
  })

  it('matches the shape every real table entry produces', () => {
    for (const [id, card] of Object.entries(listCardAffiliates())) {
      const bonus = formatBonus(card)
      expect(bonus.length, id).toBeGreaterThan(0)
      if (card.bonusMiles > 0 && card.bonusSpend && card.bonusMonths) {
        expect(bonus, id).toMatch(/^[\d,]+ points after \$[\d,]+ spend in \d+ months?$/)
      }
    }
  })
})
