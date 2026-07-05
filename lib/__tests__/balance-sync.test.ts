import { describe, expect, it } from 'vitest'
import {
  balanceAppearsInText,
  makeSyncAddress,
  parseBalancesDeterministic,
  resolveSyncAddress,
  textNumberSet,
  validateExtracted,
} from '@/lib/balance-sync'

const STATEMENT = [
  'Your United MileagePlus statement',
  'Statement date: 2026',
  'Available award miles: 45,230',
  'Amex Membership Rewards points balance: 120,500 points',
  'Hilton Honors: 8,900 points available',
].join('\n')

describe('textNumberSet / balanceAppearsInText', () => {
  it('normalizes separators so "45,230" matches 45230', () => {
    const numbers = textNumberSet(STATEMENT)
    expect(balanceAppearsInText(45230, numbers)).toBe(true)
    expect(balanceAppearsInText(120500, numbers)).toBe(true)
  })

  it('rejects a number the text never states', () => {
    const numbers = textNumberSet(STATEMENT)
    expect(balanceAppearsInText(99999, numbers)).toBe(false)
  })
})

describe('validateExtracted — the clamp', () => {
  it('accepts entries whose balances appear in the text and canonicalizes programs', () => {
    const out = validateExtracted(
      { balances: [{ program: 'United MileagePlus', balance: 45230 }] },
      STATEMENT,
    )
    expect(out).not.toBeNull()
    expect(out![0]).toMatchObject({ program: 'United MileagePlus', code: 'UA', canonical: true })
  })

  it('rejects an invented balance — digits must appear in the source text', () => {
    const out = validateExtracted(
      { balances: [{ program: 'United MileagePlus', balance: 999999 }] },
      STATEMENT,
    )
    expect(out).toBeNull()
  })

  it('drops junk entries but keeps valid siblings', () => {
    const out = validateExtracted(
      {
        balances: [
          { program: '', balance: 45230 },
          { program: 'x'.repeat(200), balance: 45230 },
          { program: 'Amex', balance: 'not a number' },
          { program: 'Amex Membership Rewards', balance: 120500 },
        ],
      },
      STATEMENT,
    )
    expect(out).toHaveLength(1)
    expect(out![0].code).toBe('AX')
  })

  it('dedupes by program identity, keeping the first entry', () => {
    const out = validateExtracted(
      {
        balances: [
          { program: 'United MileagePlus', balance: 45230 },
          { program: 'united', balance: 8900 },
        ],
      },
      STATEMENT,
    )
    expect(out).toHaveLength(1)
    expect(out![0].balance).toBe(45230)
  })

  it('rejects non-object / shapeless input', () => {
    expect(validateExtracted(null, STATEMENT)).toBeNull()
    expect(validateExtracted('nope', STATEMENT)).toBeNull()
    expect(validateExtracted({ balances: 'nope' }, STATEMENT)).toBeNull()
    expect(validateExtracted({ balances: [] }, STATEMENT)).toBeNull()
  })

  it('rejects negative and absurd balances', () => {
    const text = 'United MileagePlus: -500 miles, or 999,000,000,000'
    expect(
      validateExtracted({ balances: [{ program: 'United MileagePlus', balance: -500 }] }, text),
    ).toBeNull()
    expect(
      validateExtracted(
        { balances: [{ program: 'United MileagePlus', balance: 999000000000 }] },
        text,
      ),
    ).toBeNull()
  })
})

describe('parseBalancesDeterministic — the fallback', () => {
  it('reads program lines from a statement', () => {
    const out = parseBalancesDeterministic(STATEMENT)
    const byCode = Object.fromEntries(out.map((b) => [b.code, b.balance]))
    expect(byCode['UA']).toBe(45230)
    expect(byCode['AX']).toBe(120500)
    expect(byCode['HH']).toBe(8900)
  })

  it('skips year-looking tokens and lines without a program', () => {
    const out = parseBalancesDeterministic('Statement date: 2026\nRandom line with 12,345')
    expect(out).toHaveLength(0)
  })

  it('skips ambiguous multi-number lines without a balance keyword', () => {
    const out = parseBalancesDeterministic('United MileagePlus account 8123456 ref 45,230')
    expect(out).toHaveLength(0)
  })

  it('pairs a program line with a balance-keyword line just below it', () => {
    const out = parseBalancesDeterministic('Delta SkyMiles\nMiles available\n12,400 miles')
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ code: 'DL', balance: 12400 })
  })

  it('does not pair across a program line without a keyword confirmation', () => {
    const out = parseBalancesDeterministic('Delta SkyMiles\nConfirmation 481223\nSeat 12A')
    expect(out).toHaveLength(0)
  })

  it('uses the balance-keyword number on multi-number lines', () => {
    const out = parseBalancesDeterministic('United MileagePlus: 45,230 miles (member 1,001)')
    expect(out).toHaveLength(1)
    expect(out[0].balance).toBe(45230)
  })
})

describe('sync address', () => {
  const SECRET = 'test-secret'

  it('round-trips: mint then resolve', () => {
    const addr = makeSyncAddress('user_abc123', SECRET)
    expect(addr).toMatch(/^sync\+user_abc123\.[0-9a-f]{12}@/)
    expect(resolveSyncAddress(addr!, SECRET)).toBe('user_abc123')
  })

  it('resolves an angle-bracketed To: header form', () => {
    const addr = makeSyncAddress('user_abc123', SECRET)!
    expect(resolveSyncAddress(`hop sync <${addr}>`, SECRET)).toBe('user_abc123')
  })

  it('rejects a tampered signature or user id', () => {
    const addr = makeSyncAddress('user_abc123', SECRET)!
    const [local, domain] = addr.split('@')
    const flipped = `${local.slice(0, -1)}${local.endsWith('0') ? '1' : '0'}@${domain}`
    expect(resolveSyncAddress(flipped, SECRET)).toBeNull()
    expect(resolveSyncAddress(addr.replace('user_abc123', 'user_evil99'), SECRET)).toBeNull()
  })

  it('fails closed without a secret and on non-sync addresses', () => {
    expect(makeSyncAddress('user_abc123', null)).toBeNull()
    expect(resolveSyncAddress('sync+u.abcabcabcabc@hop.flights', null)).toBeNull()
    expect(resolveSyncAddress('support@hop.flights', 'k')).toBeNull()
    expect(resolveSyncAddress('sync+nodothere@hop.flights', 'k')).toBeNull()
  })
})
