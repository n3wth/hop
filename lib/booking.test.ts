import { describe, it, expect } from 'vitest'
import { farePolicyFromConditions, formatPenalty, describeFareRule } from './booking'

// Fare change/cancel policy mapping. The engine reads Duffel `conditions`
// defensively and must NEVER fabricate a yes/no — a missing rule stays unstated.

describe('farePolicyFromConditions', () => {
  it('maps allowed-with-penalty and not-allowed rules', () => {
    const policy = farePolicyFromConditions({
      refund_before_departure: { allowed: false, penalty_amount: null, penalty_currency: null },
      change_before_departure: {
        allowed: true,
        penalty_amount: '100.00',
        penalty_currency: 'USD',
      },
    })
    expect(policy).toEqual({
      refundable: { allowed: false, penaltyAmount: undefined, penaltyCurrency: undefined },
      changeable: { allowed: true, penaltyAmount: '100.00', penaltyCurrency: 'USD' },
    })
  })

  it('treats a zero penalty as free (no fee carried)', () => {
    const policy = farePolicyFromConditions({
      change_before_departure: { allowed: true, penalty_amount: '0.00', penalty_currency: 'USD' },
      refund_before_departure: { allowed: true, penalty_amount: '0', penalty_currency: 'USD' },
    })
    expect(policy?.changeable).toEqual({
      allowed: true,
      penaltyAmount: undefined,
      penaltyCurrency: undefined,
    })
    expect(policy?.refundable.allowed).toBe(true)
    expect(policy?.refundable.penaltyAmount).toBeUndefined()
  })

  it('leaves a rule unstated when the airline gave null', () => {
    const policy = farePolicyFromConditions({
      refund_before_departure: null,
      change_before_departure: { allowed: true, penalty_amount: null, penalty_currency: null },
    })
    expect(policy?.refundable.allowed).toBeUndefined()
    expect(policy?.changeable.allowed).toBe(true)
  })

  it('returns undefined when neither rule is stated (so the UI can omit it)', () => {
    expect(
      farePolicyFromConditions({
        refund_before_departure: null,
        change_before_departure: null,
      }),
    ).toBeUndefined()
    expect(farePolicyFromConditions(undefined)).toBeUndefined()
    expect(farePolicyFromConditions(null)).toBeUndefined()
    expect(farePolicyFromConditions('nonsense')).toBeUndefined()
    expect(farePolicyFromConditions({})).toBeUndefined()
  })

  it('never throws on malformed input', () => {
    expect(() =>
      farePolicyFromConditions({ refund_before_departure: { allowed: 'maybe' } }),
    ).not.toThrow()
    // allowed isn't a boolean → rule is unstated, so the whole thing is undefined.
    expect(
      farePolicyFromConditions({ refund_before_departure: { allowed: 'maybe' } }),
    ).toBeUndefined()
  })
})

describe('formatPenalty', () => {
  it('formats a positive penalty in its currency, rounded to whole units', () => {
    expect(formatPenalty({ allowed: true, penaltyAmount: '100.00', penaltyCurrency: 'USD' })).toBe(
      '$100 fee',
    )
    expect(formatPenalty({ allowed: true, penaltyAmount: '75.50', penaltyCurrency: 'GBP' })).toBe(
      '£76 fee',
    )
  })

  it('returns null when there is no fee', () => {
    expect(formatPenalty({ allowed: true })).toBeNull()
    expect(formatPenalty({ allowed: true, penaltyAmount: '0', penaltyCurrency: 'USD' })).toBeNull()
  })
})

describe('describeFareRule', () => {
  it('states allowed, allowed-with-fee, denied, and unstated plainly', () => {
    expect(describeFareRule({ allowed: true }, 'Refundable')).toBe('Refundable · free')
    expect(
      describeFareRule({ allowed: true, penaltyAmount: '100.00', penaltyCurrency: 'USD' }, 'Changeable'),
    ).toBe('Changeable · $100 fee')
    expect(describeFareRule({ allowed: false }, 'Refundable')).toBe('Non-refundable')
    expect(describeFareRule({}, 'Changeable')).toBe('Changeable: not stated')
  })
})
