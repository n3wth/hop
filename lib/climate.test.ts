import { describe, it, expect } from 'vitest'
import { computeSeasonality, monthRanges, type MonthlyNormals } from '@/lib/climate'

// Climate archetypes (Jan→Dec): mean temp °F + mean monthly precip mm.
const NORTHERN: MonthlyNormals = {
  tempF: [40, 43, 51, 60, 69, 77, 82, 81, 73, 62, 50, 42],
  precipMM: [50, 55, 95, 110, 120, 160, 150, 145, 120, 90, 65, 55],
}
const TROPICAL_MONSOON: MonthlyNormals = {
  tempF: [82, 83, 84, 84, 83, 82, 82, 82, 82, 82, 82, 81],
  precipMM: [240, 230, 200, 180, 160, 150, 150, 160, 180, 210, 250, 260],
}
const SOUTHERN: MonthlyNormals = {
  tempF: [73, 73, 70, 64, 58, 53, 52, 55, 60, 64, 67, 71],
  precipMM: [90, 100, 110, 120, 110, 130, 100, 80, 70, 75, 80, 75],
}
const UNIFORM_PLEASANT: MonthlyNormals = {
  tempF: [72, 72, 73, 74, 74, 75, 75, 75, 74, 74, 73, 72],
  precipMM: [60, 55, 58, 62, 60, 57, 59, 61, 60, 58, 59, 60],
}
const COLD_NORDIC: MonthlyNormals = {
  tempF: [31, 32, 36, 42, 49, 54, 57, 55, 49, 42, 36, 32],
  precipMM: [60, 50, 45, 40, 45, 50, 55, 70, 75, 85, 75, 70],
}
const DESERT_HOT: MonthlyNormals = {
  tempF: [68, 72, 79, 88, 97, 104, 106, 105, 99, 89, 77, 68],
  precipMM: [10, 8, 5, 3, 1, 0, 0, 1, 2, 5, 8, 10],
}

describe('monthRanges', () => {
  it('formats a contiguous run', () => {
    expect(monthRanges([2, 3, 4])).toBe('Mar–May')
  })
  it('honors the Dec→Jan wrap as one range', () => {
    expect(monthRanges([11, 0, 1])).toBe('Dec–Feb')
  })
  it('joins disjoint months', () => {
    expect(monthRanges([2, 9])).toBe('Mar and Oct')
  })
  it('renders a single month', () => {
    expect(monthRanges([4])).toBe('May')
  })
  it('spans a full ring', () => {
    expect(monthRanges([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])).toBe('Jan–Dec')
  })
})

describe('computeSeasonality', () => {
  it('returns null when temperature data is too sparse', () => {
    const sparse: MonthlyNormals = {
      tempF: [60, null, null, null, null, null, null, null, null, null, null, null],
      precipMM: [],
    }
    expect(computeSeasonality(sparse)).toBeNull()
  })

  it('four-season northern city: shoulder window, summer flagged for heat+rain', () => {
    const s = computeSeasonality(NORTHERN)!
    expect(s.bestMonths).toEqual([4, 8, 9])
    expect(s.avoidMonths).toEqual([6, 7])
    expect(s.summary).toBe(
      'May and Sep–Oct is the sweet spot — mild (62–73°F). Skip Jul–Aug — peak heat and rain.',
    )
  })

  it('tropical monsoon: dry-season window, wet season flagged (not heat)', () => {
    const s = computeSeasonality(TROPICAL_MONSOON)!
    expect(s.bestMonths).toEqual([4, 5, 6, 7])
    expect(s.summary).toBe(
      'May–Aug is the sweet spot — warm (82–83°F) and among the drier stretches. Skip Nov–Feb — the wet season.',
    )
  })

  it('southern hemisphere: calendar flips to their spring/summer', () => {
    const s = computeSeasonality(SOUTHERN)!
    expect(s.bestMonths).not.toContain(6) // not July (their winter)
    expect(s.warmest).toBeLessThan(2) // warmest is Jan/Feb
    expect(s.summary).toBe(
      'Sep–Jan is the sweet spot — mild (60–73°F) and among the drier stretches. Skip Jun — the wet season.',
    )
  })

  it('uniformly pleasant climate: no shaming, reads year-round', () => {
    const s = computeSeasonality(UNIFORM_PLEASANT)!
    expect(s.avoidMonths).toEqual([])
    expect(s.bestMonths.length).toBe(12)
    expect(s.summary).toBe('Mild nearly year-round (72–75°F).')
  })

  it('subarctic city: short summer window, long cold stretch flagged', () => {
    const s = computeSeasonality(COLD_NORDIC)!
    expect(s.bestMonths).toEqual([4, 5, 6])
    expect(s.summary).toBe(
      'May–Jul is the sweet spot — cool (49–57°F) and among the drier stretches. Skip Nov–Mar — deep winter cold.',
    )
  })

  it('hot desert: winter window, brutal summer flagged for heat', () => {
    const s = computeSeasonality(DESERT_HOT)!
    expect(s.bestMonths).toEqual([0, 1, 10, 11])
    expect(s.summary).toBe('Nov–Feb is the sweet spot — mild (68–77°F). Skip Apr–Oct — peak heat.')
  })

  it('scores a comfortable mild month above a freezing one', () => {
    const s = computeSeasonality(NORTHERN)!
    expect(s.scores[4]).toBeGreaterThan(s.scores[0]) // May > January
  })

  it('never fabricates a season it cannot support (no Skip when uniform)', () => {
    expect(computeSeasonality(UNIFORM_PLEASANT)!.summary).not.toMatch(/Skip/)
  })
})
