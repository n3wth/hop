import { describe, expect, it } from 'vitest'
import { destinations } from '@/lib/destinations'
import { PLACE_FACTS, CURRENCY, FX } from '@/lib/place-facts'
import { CLIMATE_NORMALS, DEST_COORDS } from '@/lib/climate-normals'

describe('committed datasets structural invariants', () => {
  it('has destination-set parity with lib/destinations.ts', () => {
    const destinationCodes = destinations.map((d) => d.code)

    expect(destinationCodes.length).toBeGreaterThan(0)

    for (const code of destinationCodes) {
      expect(PLACE_FACTS[code], `PLACE_FACTS is missing destination: ${code}`).toBeDefined()
      expect(CLIMATE_NORMALS[code], `CLIMATE_NORMALS is missing destination: ${code}`).toBeDefined()
      expect(DEST_COORDS[code], `DEST_COORDS is missing destination: ${code}`).toBeDefined()
    }
  })

  it('verifies that currency codes match /^[A-Z]{3}$/ and exist in the CURRENCY table', () => {
    for (const facts of Object.values(PLACE_FACTS)) {
      const curCode = facts.currencyCode
      if (curCode !== null) {
        expect(curCode).match(/^[A-Z]{3}$/)
        expect(CURRENCY[curCode], `CURRENCY table is missing entry for: ${curCode}`).toBeDefined()
      }
    }
  })

  it('verifies FX snapshot invariants', () => {
    expect(FX).toBeDefined()
    expect(FX.date).toBeDefined()
    expect(FX.agoDate).toBeDefined()

    const dateMs = Date.parse(FX.date)
    const agoDateMs = Date.parse(FX.agoDate)

    expect(Number.isFinite(dateMs)).toBe(true)
    expect(Number.isFinite(agoDateMs)).toBe(true)
    expect(dateMs).toBeGreaterThanOrEqual(agoDateMs)

    for (const [code, rate] of Object.entries(FX.rates)) {
      expect(code).match(/^[A-Z]{3}$/)
      expect(Number.isFinite(rate)).toBe(true)
      expect(rate).toBeGreaterThan(0)
    }

    for (const [code, rate] of Object.entries(FX.agoRates)) {
      expect(code).match(/^[A-Z]{3}$/)
      expect(Number.isFinite(rate)).toBe(true)
      expect(rate).toBeGreaterThan(0)
    }
  })

  it('verifies 12 climate normals per destination', () => {
    for (const [code, normals] of Object.entries(CLIMATE_NORMALS)) {
      expect(normals.tempF, `CLIMATE_NORMALS for ${code} tempF is missing`).toBeDefined()
      expect(normals.precipMM, `CLIMATE_NORMALS for ${code} precipMM is missing`).toBeDefined()
      expect(normals.tempF).toHaveLength(12)
      expect(normals.precipMM).toHaveLength(12)

      for (const t of normals.tempF) {
        if (t !== null) {
          expect(Number.isFinite(t)).toBe(true)
        }
      }

      for (const p of normals.precipMM) {
        if (p !== null) {
          expect(Number.isFinite(p)).toBe(true)
        }
      }
    }
  })
})
