import { describe, it, expect } from 'vitest'
import type { Balance } from '@/lib/types'
import {
  ledgerDream,
  aspirationScore,
  reachableDreamCount,
} from '@/lib/ledger-dream'
import { destinations, computeCpp } from '@/lib/destinations'

const b = (program: string, balance: number, code = ''): Balance => ({
  program,
  code,
  balance,
})

describe('aspirationScore', () => {
  it('rates a long-haul reach above a short hop', () => {
    const syd = destinations.find((d) => d.code === 'SYD')!
    const yvr = destinations.find((d) => d.code === 'YVR')!
    expect(aspirationScore(syd)).toBeGreaterThan(aspirationScore(yvr))
  })

  it('is deterministic for the same destination', () => {
    const tok = destinations.find((d) => d.code === 'NRT')!
    expect(aspirationScore(tok)).toBe(aspirationScore(tok))
  })
})

describe('ledgerDream — reachable (real balances)', () => {
  it('picks an aspirational redemption the user can actually book now', () => {
    // A big Amex MR pile transfers 1:1 to ANA/KrisFlyer/etc — long-haul unlocks.
    const dream = ledgerDream([b('Amex Membership Rewards', 120000, 'AX')])
    expect(dream.saveToward).toBe(false)
    expect(dream.affordableNow).toBe(true)
    // The effective balance must actually cover the award (engine, not vibes).
    expect(dream.proof.effectiveBalance).toBeDefined()
    expect(dream.proof.effectiveBalance!).toBeGreaterThanOrEqual(dream.milesNeeded)
  })

  it('prefers a long-haul dream over a cheap hop when both are reachable', () => {
    const dream = ledgerDream([b('Amex Membership Rewards', 120000, 'AX')])
    // With 120k MR, the engine should reach for something aspirational, not YVR.
    expect(dream.milesNeeded).toBeGreaterThanOrEqual(30000)
    expect(dream.destination.code).not.toBe('YVR')
  })

  it('numbers come straight from the engine (cpp + cashValue match the dataset)', () => {
    const dream = ledgerDream([b('Amex Membership Rewards', 120000, 'AX')])
    const d = dream.destination
    expect(dream.cpp).toBe(computeCpp(d))
    expect(dream.cashValue).toBe(d.typicalCashUSD)
    expect(dream.milesNeeded).toBe(d.typicalAwardMiles)
  })

  it('narrates a transfer path when the user holds a bank currency', () => {
    const dream = ledgerDream([b('Amex Membership Rewards', 120000, 'AX')])
    // Amex MR reaches the airline via transfer (it does not directly hold e.g. ANA).
    expect(dream.via?.kind).toBe('transfer')
    expect(dream.proof.transferFrom).toBeDefined()
    expect(dream.proof.path).toContain('→')
    expect(dream.proof.path).toContain(dream.proof.transferFrom!.ratio)
  })

  it('narrates a direct hold when the user holds the booking program itself', () => {
    // Hold Alaska Mileage Plan directly — Maui/Honolulu book on it.
    const dream = ledgerDream([b('Alaska Mileage Plan', 60000, 'AS')])
    expect(dream.via?.kind).toBe('direct')
    expect(dream.proof.transferFrom).toBeUndefined()
    expect(dream.proof.path).toContain('held directly')
  })
})

describe('ledgerDream — "Dream me another" (index walk)', () => {
  it('index selects different corners of a multi-dream portfolio', () => {
    const balances = [b('Amex Membership Rewards', 200000, 'AX')]
    const count = reachableDreamCount(balances)
    expect(count).toBeGreaterThan(1)
    const a = ledgerDream(balances, 0)
    const c = ledgerDream(balances, 1)
    expect(a.destination.code).not.toBe(c.destination.code)
  })

  it('wraps around deterministically', () => {
    const balances = [b('Amex Membership Rewards', 200000, 'AX')]
    const count = reachableDreamCount(balances)
    const first = ledgerDream(balances, 0)
    const wrapped = ledgerDream(balances, count)
    expect(wrapped.destination.code).toBe(first.destination.code)
  })

  it('is stable: same input + index → same pick', () => {
    const balances = [b('Amex Membership Rewards', 200000, 'AX')]
    expect(ledgerDream(balances, 2).destination.code).toBe(
      ledgerDream(balances, 2).destination.code,
    )
  })
})

describe('ledgerDream — save-toward fallback', () => {
  it('signed-out / no balances → a best dream to save toward', () => {
    const dream = ledgerDream([])
    expect(dream.saveToward).toBe(true)
    expect(dream.affordableNow).toBe(false)
    expect(dream.via).toBeUndefined()
    expect(dream.proof.effectiveBalance).toBeUndefined()
    expect(dream.proof.path).toContain('Save toward')
  })

  it('fallback is still a real, aspirational destination with engine numbers', () => {
    const dream = ledgerDream([])
    const d = dream.destination
    expect(destinations.some((x) => x.code === d.code)).toBe(true)
    expect(dream.cpp).toBe(computeCpp(d))
    expect(dream.milesNeeded).toBe(d.typicalAwardMiles)
  })

  it('falls back when the user holds points but cannot reach any award', () => {
    // 3k Amex MR reaches nothing one-way in the dataset.
    const dream = ledgerDream([b('Amex Membership Rewards', 3000, 'AX')])
    expect(dream.saveToward).toBe(true)
    expect(reachableDreamCount([b('Amex Membership Rewards', 3000, 'AX')])).toBe(0)
  })

  it('fallback index still varies the pick', () => {
    const a = ledgerDream([], 0)
    const c = ledgerDream([], 1)
    expect(a.destination.code).not.toBe(c.destination.code)
  })
})
