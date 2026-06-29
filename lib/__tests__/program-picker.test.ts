import { describe, it, expect } from 'vitest'
import { listPrograms, canonicalizeProgram, type ProgramDef } from '../programs'

// Mirrors the in-component filter in components/ProgramPicker.tsx — kept here as
// a pure function so the matching contract (name + alias, substring) is testable
// without rendering. If the component filter changes, update both.
const ALL = listPrograms()
function filterPrograms(query: string): ProgramDef[] {
  const q = query.trim().toLowerCase()
  if (!q) return ALL
  return ALL.filter(
    (p) => p.name.toLowerCase().includes(q) || p.aliases.some((a) => a.includes(q)),
  )
}

describe('program picker filter', () => {
  it('matches by canonical name substring', () => {
    expect(filterPrograms('hyatt').map((p) => p.id)).toContain('hyatt')
    expect(filterPrograms('united').map((p) => p.id)).toContain('united')
  })

  it('matches by alias, not just name', () => {
    // "mr" is an Amex alias; the name "Amex Membership Rewards" also contains it.
    expect(filterPrograms('membership rewards').map((p) => p.id)).toContain('amex-mr')
    // "venture" only appears as a Capital One alias, never in a name.
    expect(filterPrograms('venture').map((p) => p.id)).toEqual(['capital-one'])
    // "skymiles" is a Delta alias.
    expect(filterPrograms('skymiles').map((p) => p.id)).toEqual(['delta'])
  })

  it('returns the whole registry for an empty query', () => {
    expect(filterPrograms('').length).toBe(ALL.length)
    expect(filterPrograms('   ').length).toBe(ALL.length)
  })

  it('returns nothing for a non-matching query', () => {
    expect(filterPrograms('zzzznope')).toEqual([])
  })
})

describe('selection yields a stable canonical name', () => {
  it('every program name canonicalizes back to its own id', () => {
    // The picker fills p.name on select; the server canonicalizes on save. This
    // round-trip must be a fixed point so a selected program is never re-mapped.
    for (const p of ALL) {
      expect(canonicalizeProgram(p.name)?.id).toBe(p.id)
    }
  })
})
