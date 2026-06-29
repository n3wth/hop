import { describe, it, expect } from 'vitest'
import {
  PROGRAMS,
  canonicalizeProgram,
  programById,
  listPrograms,
  listTransferablePrograms,
} from '../programs'
import { destinations } from '../destinations'

describe('registry integrity', () => {
  it('has unique ids', () => {
    const ids = PROGRAMS.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('every def is well-formed', () => {
    for (const p of PROGRAMS) {
      expect(p.id).toMatch(/^[a-z0-9-]+$/)
      expect(p.name.length).toBeGreaterThan(0)
      expect(p.code.length).toBeGreaterThanOrEqual(2)
      expect(['bank', 'airline', 'hotel']).toContain(p.kind)
      expect(Array.isArray(p.aliases)).toBe(true)
    }
  })

  it('only bank currencies are transferable', () => {
    for (const p of PROGRAMS) {
      if (p.transferable) expect(p.kind).toBe('bank')
    }
    expect(listTransferablePrograms().map((p) => p.id).sort()).toEqual(
      ['amex-mr', 'bilt', 'capital-one', 'chase-ur', 'citi-typ'].sort(),
    )
  })
})

describe('canonicalizeProgram() — exact + abbreviations', () => {
  it('resolves canonical names', () => {
    expect(canonicalizeProgram('Amex Membership Rewards')?.id).toBe('amex-mr')
    expect(canonicalizeProgram('Chase Ultimate Rewards')?.id).toBe('chase-ur')
    expect(canonicalizeProgram('Delta SkyMiles')?.id).toBe('delta')
  })

  it('resolves common abbreviations', () => {
    expect(canonicalizeProgram('Amex MR')?.id).toBe('amex-mr')
    expect(canonicalizeProgram('amex')?.id).toBe('amex-mr')
    expect(canonicalizeProgram('Chase UR')?.id).toBe('chase-ur')
    expect(canonicalizeProgram('MileagePlus')?.id).toBe('united')
    expect(canonicalizeProgram('AAdvantage')?.id).toBe('american')
    expect(canonicalizeProgram('Rapid Rewards')?.id).toBe('southwest')
    expect(canonicalizeProgram('TrueBlue')?.id).toBe('jetblue')
    expect(canonicalizeProgram('Avios')?.id).toBe('avios-ba')
    expect(canonicalizeProgram('KrisFlyer')?.id).toBe('krisflyer')
    expect(canonicalizeProgram('Cap One')?.id).toBe('capital-one')
  })

  it('is case- and punctuation-insensitive', () => {
    expect(canonicalizeProgram('  AMEX   mr  ')?.id).toBe('amex-mr')
    expect(canonicalizeProgram('Miles & Smiles')?.id).toBe('turkish')
    expect(canonicalizeProgram('air france / klm')?.id).toBe('flying-blue')
  })

  it('handles ambiguous ANA name', () => {
    expect(canonicalizeProgram('All Nippon Airways')?.id).toBe('ana')
    expect(canonicalizeProgram('ANA')?.id).toBe('ana')
  })
})

describe('canonicalizeProgram() — phrasing', () => {
  it('picks the earliest distinctive token in "X via Y" phrasing', () => {
    expect(canonicalizeProgram('ANA via Amex MR')?.id).toBe('ana')
    expect(canonicalizeProgram('Singapore KrisFlyer via Amex MR')?.id).toBe('krisflyer')
    expect(canonicalizeProgram('Air Canada via Amex MR')?.id).toBe('aeroplan')
    expect(canonicalizeProgram('United via Chase UR')?.id).toBe('united')
  })
})

describe('canonicalizeProgram() — typos', () => {
  it('tolerates single-character typos', () => {
    expect(canonicalizeProgram('skymiels')?.id).toBe('delta')
    expect(canonicalizeProgram('membersihp rewards')?.id).toBe('amex-mr')
    expect(canonicalizeProgram('aeroplann')?.id).toBe('aeroplan')
    expect(canonicalizeProgram('emirats')?.id).toBe('emirates')
  })
})

describe('canonicalizeProgram() — misses', () => {
  it('returns undefined for empty or unknown input', () => {
    expect(canonicalizeProgram('')).toBeUndefined()
    expect(canonicalizeProgram('   ')).toBeUndefined()
    expect(canonicalizeProgram('Nowhere Air Rewards')).toBeUndefined()
  })
})

describe('lookups', () => {
  it('programById resolves and rejects', () => {
    expect(programById('hyatt')?.name).toBe('World of Hyatt')
    expect(programById('nope')).toBeUndefined()
  })

  it('listPrograms returns a defensive copy', () => {
    const a = listPrograms()
    a.pop()
    expect(listPrograms().length).toBe(PROGRAMS.length)
  })
})

describe('destination bestProgram strings canonicalize', () => {
  // Two destinations name only an alliance ("X via Star Alliance") with no
  // registry-backed program token; everything else must resolve to a ProgramDef.
  const ALLIANCE_ONLY = new Set(['Aegean via Star Alliance', 'TAP via Star Alliance'])

  it('every bestProgram with a named program maps to a known program', () => {
    const misses: string[] = []
    for (const d of destinations) {
      if (ALLIANCE_ONLY.has(d.bestProgram)) continue
      if (!canonicalizeProgram(d.bestProgram)) misses.push(d.bestProgram)
    }
    expect(misses).toEqual([])
  })
})
