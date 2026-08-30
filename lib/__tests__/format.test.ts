import { describe, it, expect } from 'vitest'
import { formatUSD, formatPoints } from '../format'

describe('formatUSD', () => {
  it('formats positive float numbers with rounding', () => {
    expect(formatUSD(1234.5)).toBe('$1,235')
    expect(formatUSD(1234.4)).toBe('$1,234')
  })

  it('formats zero and negative numbers', () => {
    expect(formatUSD(0)).toBe('$0')
    expect(formatUSD(-1234)).toBe('$-1,234')
  })

  it('handles null, undefined, and non-finite values safely', () => {
    expect(formatUSD(null)).toBe('')
    expect(formatUSD(undefined)).toBe('')
    expect(formatUSD(Infinity)).toBe('')
    expect(formatUSD(NaN)).toBe('')
  })
})

describe('formatPoints', () => {
  it('formats positive integers with commas', () => {
    expect(formatPoints(60000)).toBe('60,000')
    expect(formatPoints(1234567.8)).toBe('1,234,568')
  })

  it('formats zero and negative points', () => {
    expect(formatPoints(0)).toBe('0')
    expect(formatPoints(-500)).toBe('-500')
  })

  it('handles null, undefined, and non-finite values safely', () => {
    expect(formatPoints(null)).toBe('')
    expect(formatPoints(undefined)).toBe('')
    expect(formatPoints(Infinity)).toBe('')
    expect(formatPoints(NaN)).toBe('')
  })
})
