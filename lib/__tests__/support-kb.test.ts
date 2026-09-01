import { describe, it, expect } from 'vitest'
import { SUPPORT_KB, searchSupportKb, fallbackSupportAnswer } from '@/lib/support-kb'
import { SECTIONS } from '@/app/support/page'
import { POINTS_THRESHOLD_CPP, TIER_GREEN_CPP, TIER_AMBER_CPP } from '@/lib/cpp'

describe('support-kb', () => {
  it('ranks verdict entry first for cash-vs-points questions', () => {
    const hits = searchSupportKb('why did hop say pay cash', 3)
    expect(hits.length).toBeGreaterThan(0)
    expect(hits[0].slug).toBe('the-verdict')
  })

  it('returns empty array for empty or garbage query', () => {
    expect(searchSupportKb('')).toEqual([])
    expect(searchSupportKb('   ')).toEqual([])
    expect(searchSupportKb('a')).toEqual([])
  })

  it('has unique and non-empty anchors', () => {
    const anchors = SUPPORT_KB.map((e) => e.anchor)
    expect(anchors.length).toBeGreaterThan(0)
    expect(new Set(anchors).size).toBe(anchors.length)
    for (const a of anchors) {
      expect(a.trim().length).toBeGreaterThan(0)
    }
  })

  it('anchor drift test: every KB anchor exists in app/support/page SECTIONS', () => {
    const sectionIds = new Set(SECTIONS.map((s) => s.id))
    for (const entry of SUPPORT_KB) {
      expect(sectionIds.has(entry.anchor)).toBe(true)
    }
  })

  it('uses engine constants for threshold text (no drift)', () => {
    const verdictEntry = SUPPORT_KB.find((e) => e.slug === 'the-verdict')
    expect(verdictEntry).toBeDefined()
    expect(verdictEntry?.body).toContain(TIER_GREEN_CPP.toFixed(1))
    expect(verdictEntry?.body).toContain(TIER_AMBER_CPP.toFixed(1))
    expect(verdictEntry?.body).toContain(POINTS_THRESHOLD_CPP.toFixed(1))
  })

  it('fallback-invents-nothing: fallbackSupportAnswer contains mailto and no invented economic numbers', () => {
    const answer = fallbackSupportAnswer('how do i change my ticket')
    expect(answer).toContain('hop@n3wth.com')
    expect(answer).toContain('/support#')
    // Must not contain numeric ¢/pt or dollar figures
    expect(answer).not.toMatch(/\d+(\.\d+)?\s*(¢\/pt|miles|\$)/)
  })
})
