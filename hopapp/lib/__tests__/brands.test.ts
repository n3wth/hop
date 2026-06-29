import { describe, it, expect } from 'vitest'
import {
  BRANDS,
  resolveBrand,
  monogramGlyph,
  monogramHue,
  lighten,
  type BrandSlug,
} from '../brands'

describe('resolveBrand()', () => {
  it('prefers an explicit slug', () => {
    expect(resolveBrand({ slug: 'delta', code: 'AA', name: 'United' })).toBe('delta')
  })

  it('matches by IATA code', () => {
    expect(resolveBrand({ code: 'DL' })).toBe('delta')
    expect(resolveBrand({ code: 'b6' })).toBe('jetblue') // case-insensitive
    expect(resolveBrand({ code: 'LH' })).toBe('lufthansa')
    expect(resolveBrand({ code: 'CX' })).toBe('cathay')
  })

  it('matches by name substring when code is absent', () => {
    expect(resolveBrand({ name: 'Air France' })).toBe('airfrance')
    expect(resolveBrand({ name: 'Virgin Atlantic Flying Club' })).toBe('virginatlantic')
    expect(resolveBrand({ name: 'All Nippon Airways' })).toBe('ana')
  })

  it('maps loyalty programs by name', () => {
    expect(resolveBrand({ name: 'Membership Rewards' })).toBe('amex')
    expect(resolveBrand({ name: 'Chase Ultimate Rewards' })).toBe('chase')
  })

  it('returns undefined for unknown carriers', () => {
    expect(resolveBrand({ code: 'ZZ', name: 'Nowhere Air' })).toBeUndefined()
    expect(resolveBrand({})).toBeUndefined()
  })

  it('every resolvable slug has a brand def', () => {
    const slugs: BrandSlug[] = Object.keys(BRANDS) as BrandSlug[]
    for (const slug of slugs) {
      expect(BRANDS[slug]).toBeDefined()
      expect(BRANDS[slug].hue).toMatch(/^#|^hsl/)
      expect(BRANDS[slug].mono.length).toBeGreaterThan(0)
    }
  })
})

describe('monogramGlyph()', () => {
  it('uses the 2-letter IATA code when present', () => {
    expect(monogramGlyph('B6', 'JetBlue')).toBe('B6')
    expect(monogramGlyph('dl', 'Delta')).toBe('DL')
  })

  it('falls back to two name letters when no usable code', () => {
    expect(monogramGlyph('', 'Frontier')).toBe('FR')
    expect(monogramGlyph(undefined, 'gol smiles')).toBe('GO')
  })

  it('never returns empty for any input', () => {
    expect(monogramGlyph('', '').length).toBeGreaterThan(0)
    expect(monogramGlyph(undefined, undefined)).toBe('?')
  })
})

describe('monogramHue()', () => {
  it('is deterministic per glyph', () => {
    expect(monogramHue('DL')).toBe(monogramHue('DL'))
  })

  it('returns a muted hsl in the cohesive bands', () => {
    const hsl = monogramHue('XY')
    const m = hsl.match(/^hsl\((\d+), 32%, 42%\)$/)
    expect(m).not.toBeNull()
    const h = Number(m![1])
    const inWarm = h >= 18 && h <= 39
    const inTeal = h >= 172 && h <= 215
    expect(inWarm || inTeal).toBe(true)
  })
})

describe('lighten()', () => {
  it('lightens hex toward white', () => {
    expect(lighten('#000000')).toBe('rgb(140, 140, 140)')
  })

  it('bumps hsl lightness', () => {
    expect(lighten('hsl(190, 32%, 42%)')).toBe('hsl(190, 32%, 76%)')
  })
})
