import { describe, it, expect } from 'vitest'
import { programGuides, programGuideBySlug, allProgramGuideSlugs } from '../program-guides'

describe('programGuides()', () => {
  it('returns one guide per transferable bank currency with partners', () => {
    const guides = programGuides()
    const slugs = guides.map((g) => g.slug)
    expect(slugs).toEqual(expect.arrayContaining(['amex-mr', 'chase-ur', 'citi-typ', 'capital-one', 'bilt']))
    expect(guides.length).toBe(5)
  })

  it('ranks partners by baseline cpp, best value first', () => {
    const amex = programGuideBySlug('amex-mr')
    expect(amex).toBeDefined()
    const cpps = amex!.partners.map((p) => p.baselineCpp)
    for (let i = 1; i < cpps.length; i++) {
      expect(cpps[i]).toBeLessThanOrEqual(cpps[i - 1])
    }
  })

  it('never invents a transfer edge — every partner traces back to lib/transfers', () => {
    const amex = programGuideBySlug('amex-mr')!
    const partnerIds = amex.partners.map((p) => p.id)
    // Amex does not partner with United (lib/transfers.ts GRAPH comment).
    expect(partnerIds).not.toContain('united')
    // Verified Amex partner.
    expect(partnerIds).toContain('virgin-atlantic')
  })

  it('cross-references sweet spots reachable through a currency\'s partners', () => {
    const amex = programGuideBySlug('amex-mr')!
    // Amex -> Virgin Atlantic -> ANA First to Japan is a seeded sweet spot.
    const virgin = amex.partners.find((p) => p.id === 'virgin-atlantic')
    expect(virgin?.sweetSpots.length).toBeGreaterThan(0)
    expect(amex.reachableSweetSpots.length).toBeGreaterThan(0)
  })

  it('is undefined for an unknown slug, never throws', () => {
    expect(programGuideBySlug('not-a-real-program')).toBeUndefined()
  })

  it('allProgramGuideSlugs matches programGuides()', () => {
    expect(allProgramGuideSlugs()).toEqual(programGuides().map((g) => g.slug))
  })
})
