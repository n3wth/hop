import { describe, it, expect } from 'vitest'
import { essentials, dollarSignal, fxAsOf } from '@/lib/place-info'

describe('essentials', () => {
  it('returns currency, language, and offset for a known destination', () => {
    const e = essentials('NRT')
    expect(e.currency).toEqual({ code: 'JPY', name: 'Japanese yen', symbol: '¥' })
    expect(e.language).toBe('Japanese')
    expect(e.utcOffset).toBe('UTC+9')
  })

  it('is all-null for an unknown code', () => {
    expect(essentials('XXX')).toEqual({ currency: null, language: null, utcOffset: null })
  })
})

describe('dollarSignal', () => {
  it('shows the rate and an "up" trend when the dollar strengthened', () => {
    // JPY 144.6 → 161.86 over the year ≈ +12%.
    expect(dollarSignal('NRT')).toBe('$1 ≈ ¥162 — up 12% over the past year, so your money goes further here.')
  })

  it('formats sub-1 rates to two decimals (euro)', () => {
    const s = dollarSignal('CDG')!
    expect(s.startsWith('$1 ≈ €0.88')).toBe(true)
  })

  it('formats large rates with thousands separators (won)', () => {
    expect(dollarSignal('ICN')!.startsWith('$1 ≈ ₩1,544')).toBe(true)
  })

  it('returns null for a US destination (no conversion)', () => {
    expect(dollarSignal('HNL')).toBeNull()
  })

  it('returns null when the currency has no ECB rate on file', () => {
    expect(dollarSignal('EZE')).toBeNull() // ARS not in Frankfurter coverage
  })

  it('never throws on an unknown code', () => {
    expect(dollarSignal('XXX')).toBeNull()
  })
})

describe('fxAsOf', () => {
  it('renders a Month YYYY stamp', () => {
    expect(fxAsOf()).toMatch(/^[A-Z][a-z]{2} \d{4}$/)
  })
})
