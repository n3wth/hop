import { describe, expect, it } from 'vitest'
import { destinations } from '@/lib/destinations'
import { PLACE_FACTS, CURRENCY, FX, GENERATED_AT as PLACE_FACTS_GENERATED_AT } from '@/lib/place-facts'
import { CLIMATE_NORMALS, DEST_COORDS, GENERATED_AT as CLIMATE_GENERATED_AT } from '@/lib/climate-normals'

describe('data snapshot invariants', () => {
  it('covers every destination in destinations.ts in PLACE_FACTS and CLIMATE_NORMALS', () => {
    const destCodes = destinations.map((d) => d.code)
    for (const code of destCodes) {
      expect(PLACE_FACTS[code], `missing PLACE_FACTS for ${code}`).toBeDefined()
      expect(CLIMATE_NORMALS[code], `missing CLIMATE_NORMALS for ${code}`).toBeDefined()
      expect(DEST_COORDS[code], `missing DEST_COORDS for ${code}`).toBeDefined()
    }
  })

  it('validates currency codes and CURRENCY table', () => {
    for (const [code, fact] of Object.entries(PLACE_FACTS)) {
      if (fact.currencyCode) {
        expect(fact.currencyCode).toMatch(/^[A-Z]{3}$/)
        expect(
          CURRENCY[fact.currencyCode],
          `missing CURRENCY entry for ${fact.currencyCode} (destination ${code})`,
        ).toBeDefined()
        expect(CURRENCY[fact.currencyCode].name).toBeTruthy()
        expect(CURRENCY[fact.currencyCode].symbol).toBeTruthy()
      }
    }
  })

  it('validates FX snapshot rates', () => {
    expect(FX.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(FX.agoDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(Date.parse(FX.date)).toBeGreaterThanOrEqual(Date.parse(FX.agoDate))

    for (const [cur, rate] of Object.entries(FX.rates)) {
      expect(cur).toMatch(/^[A-Z]{3}$/)
      expect(Number.isFinite(rate)).toBe(true)
      expect(rate).toBeGreaterThan(0)
    }
    for (const [cur, rate] of Object.entries(FX.agoRates)) {
      expect(cur).toMatch(/^[A-Z]{3}$/)
      expect(Number.isFinite(rate)).toBe(true)
      expect(rate).toBeGreaterThan(0)
    }
  })

  it('validates 12 monthly climate normals per destination', () => {
    for (const [code, normal] of Object.entries(CLIMATE_NORMALS)) {
      expect(normal.tempF, `tempF for ${code}`).toHaveLength(12)
      expect(normal.precipMM, `precipMM for ${code}`).toHaveLength(12)
      for (let i = 0; i < 12; i++) {
        const t = normal.tempF[i]
        const p = normal.precipMM[i]
        if (t !== null) {
          expect(Number.isFinite(t)).toBe(true)
        }
        if (p !== null) {
          expect(Number.isFinite(p)).toBe(true)
          expect(p).toBeGreaterThanOrEqual(0)
        }
      }
    }
  })

  it('has parseable GENERATED_AT timestamps', () => {
    expect(PLACE_FACTS_GENERATED_AT).toBeDefined()
    expect(Number.isNaN(Date.parse(PLACE_FACTS_GENERATED_AT))).toBe(false)
    expect(CLIMATE_GENERATED_AT).toBeDefined()
    expect(Number.isNaN(Date.parse(CLIMATE_GENERATED_AT))).toBe(false)
  })
})
