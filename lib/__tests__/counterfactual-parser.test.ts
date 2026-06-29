import { describe, it, expect } from 'vitest'
import {
  parseMutationFallback,
  validateMutation,
} from '@/lib/counterfactual-parser'

describe('validateMutation — clamps to known programs', () => {
  it('accepts a well-formed add and canonicalizes the program', () => {
    const m = validateMutation({ op: 'add', program: 'chase ur', amount: 50000 })
    expect(m).toEqual({ op: 'add', program: 'chase-ur', amount: 50000 })
  })

  it('rejects an unknown program', () => {
    expect(validateMutation({ op: 'add', program: 'zzqxwv', amount: 1000 })).toBeNull()
  })

  it('rejects non-positive / non-finite amounts', () => {
    expect(validateMutation({ op: 'set', program: 'amex', amount: 0 })).toBeNull()
    expect(validateMutation({ op: 'set', program: 'amex', amount: -5 })).toBeNull()
    expect(validateMutation({ op: 'set', program: 'amex', amount: Infinity })).toBeNull()
  })

  it('clamps absurd amounts to a believable ceiling', () => {
    const m = validateMutation({ op: 'add', program: 'amex', amount: 1e12 })
    expect(m).toEqual({ op: 'add', program: 'amex-mr', amount: 10_000_000 })
  })

  it('parses a numeric string amount', () => {
    const m = validateMutation({ op: 'add', program: 'amex', amount: '50,000' })
    expect(m).toEqual({ op: 'add', program: 'amex-mr', amount: 50000 })
  })

  it('swap requires two distinct known programs', () => {
    expect(validateMutation({ op: 'swap', from: 'delta', to: 'alaska' })).toEqual({
      op: 'swap',
      from: 'delta',
      to: 'alaska',
    })
    expect(validateMutation({ op: 'swap', from: 'delta', to: 'delta' })).toBeNull()
    expect(validateMutation({ op: 'swap', from: 'delta', to: 'nope' })).toBeNull()
  })

  it('rejects unknown ops and non-objects', () => {
    expect(validateMutation({ op: 'multiply', program: 'amex', amount: 1 })).toBeNull()
    expect(validateMutation(null)).toBeNull()
    expect(validateMutation('add amex')).toBeNull()
  })
})

describe('parseMutationFallback — deterministic offline parse', () => {
  it('"50k more Chase UR" -> add chase-ur 50000', () => {
    expect(parseMutationFallback('what if I had 50k more Chase UR')).toEqual({
      op: 'add',
      program: 'chase-ur',
      amount: 50000,
    })
  })

  it('"another 30,000 Amex" -> add amex-mr 30000', () => {
    expect(parseMutationFallback('what if I had another 30,000 Amex points')).toEqual({
      op: 'add',
      program: 'amex-mr',
      amount: 30000,
    })
  })

  it('"100k Amex" with no "more" reads as a SET target', () => {
    expect(parseMutationFallback('what if I had 100k Amex')).toEqual({
      op: 'set',
      program: 'amex-mr',
      amount: 100000,
    })
  })

  it('"Alaska instead of Delta" -> swap delta -> alaska', () => {
    expect(parseMutationFallback('what if I held Alaska instead of Delta')).toEqual({
      op: 'swap',
      from: 'delta',
      to: 'alaska',
    })
  })

  it('"swap Delta for Alaska" -> swap delta -> alaska', () => {
    expect(parseMutationFallback('swap Delta for Alaska')).toEqual({
      op: 'swap',
      from: 'delta',
      to: 'alaska',
    })
  })

  it('"50 thousand more United" expands the word form', () => {
    expect(parseMutationFallback('50 thousand more United')).toEqual({
      op: 'add',
      program: 'united',
      amount: 50000,
    })
  })

  it('returns null when nothing parses', () => {
    expect(parseMutationFallback('what is the weather in tokyo')).toBeNull()
    expect(parseMutationFallback('')).toBeNull()
  })
})
