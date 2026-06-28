import { describe, it, expect } from 'vitest'
import { transfersTo } from '../transfers'
import type { Balance } from '@/lib/types'

const makeBalance = (program: string, code: string, balance: number): Balance => ({
  program,
  code,
  balance,
})

describe('transfersTo()', () => {
  const balances: Balance[] = [
    makeBalance('Amex MR', 'AX', 50000),
    makeBalance('Chase UR', 'CU', 30000),
    makeBalance('Bilt', 'BT', 10000),
  ]

  it('returns direct partners (Chase UR, Bilt) for United award; result is non-empty', () => {
    const result = transfersTo('United MileagePlus', balances)
    const sources = result.map(r => r.source)
    expect(sources).toContain('Chase UR')
    expect(sources).toContain('Bilt')
    expect(result.length).toBeGreaterThan(0)
  })

  it('returns [] for a program with no reachable currency', () => {
    const result = transfersTo('Some Random Airline', balances)
    expect(result).toEqual([])
  })

  it('matches Alaska tolerantly (Alaska matches Alaska Atmos Rewards)', () => {
    const result = transfersTo('Alaska Atmos Rewards', balances)
    const sources = result.map(r => r.source)
    expect(sources).toContain('Bilt')
  })

  it('matches BA Avios tolerantly (British Airways Avios)', () => {
    const result = transfersTo('British Airways Avios', balances)
    const sources = result.map(r => r.source)
    expect(sources).toContain('Amex MR')
    expect(sources).toContain('Chase UR')
    expect(sources).toContain('Bilt')
  })

  it('excludes sources with zero balance', () => {
    const zeroBalances: Balance[] = [
      makeBalance('Amex MR', 'AX', 0),
      makeBalance('Chase UR', 'CU', 30000),
    ]
    const result = transfersTo('United MileagePlus', zeroBalances)
    const sources = result.map(r => r.source)
    expect(sources).not.toContain('Amex MR')
    expect(sources).toContain('Chase UR')
  })

  it('returns [] when balances array is empty', () => {
    const result = transfersTo('United MileagePlus', [])
    expect(result).toEqual([])
  })
})
