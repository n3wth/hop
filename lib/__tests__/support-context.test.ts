import { describe, it, expect } from 'vitest'
import { snapshotSummary, buildSupportSystem, type AccountSnapshot } from '@/lib/support-context'
import { ALERT_LIMITS } from '@/lib/subscription'
import { POINTS_THRESHOLD_CPP, TIER_GREEN_CPP, TIER_AMBER_CPP } from '@/lib/cpp'

describe('support-context', () => {
  it('snapshotSummary for signed-out user', () => {
    const summary = snapshotSummary({
      signedIn: false,
      balances: [],
      tier: 'free',
      standingOrders: [],
      alerts: [],
      escalations: [],
      prefs: {},
      hasAwardWallet: false,
    })
    expect(summary).toBe('User is signed out. No account data available.')
  })

  it('snapshotSummary empty balances phrasing', () => {
    const snapshot: AccountSnapshot = {
      signedIn: true,
      userId: 'user_123',
      balances: [],
      tier: 'free',
      standingOrders: [],
      alerts: [],
      escalations: [],
      prefs: {},
      hasAwardWallet: false,
    }
    const summary = snapshotSummary(snapshot)
    expect(summary).toContain('Loyalty balances: No programs on file.')
    expect(summary).toContain(`Plan tier (as recorded): free (${ALERT_LIMITS.free} active alerts max)`)
  })

  it('snapshotSummary renders wallet value and balances verbatim', () => {
    const snapshot: AccountSnapshot = {
      signedIn: true,
      userId: 'user_123',
      balances: [
        { code: 'chase', program: 'Chase Sapphire', balance: 50000 },
        { code: 'united', program: 'United MileagePlus', balance: 25000 },
      ],
      tier: 'premium',
      standingOrders: [],
      alerts: [],
      escalations: [],
      prefs: { homeAirport: 'SFO' },
      hasAwardWallet: true,
    }
    const summary = snapshotSummary(snapshot, 1125)
    expect(summary).toContain('Chase Sapphire: 50,000 pts')
    expect(summary).toContain('United MileagePlus: 25,000 pts')
    expect(summary).toContain('Estimated total wallet value: $1,125')
    expect(summary).toContain('Plan tier (as recorded): premium (unlimited active alerts)')
    expect(summary).toContain('Home airport: SFO')
    expect(summary).toContain('AwardWallet: connected')
  })

  it('whitelist test: snapshotSummary never reflects unwhitelisted property injection', () => {
    const snapshot: AccountSnapshot & { secretApiToken?: string; stripeCustomerId?: string } = {
      signedIn: true,
      userId: 'user_123',
      balances: [],
      tier: 'free',
      standingOrders: [],
      alerts: [],
      escalations: [],
      prefs: {},
      hasAwardWallet: false,
      secretApiToken: 'secret_token_12345',
      stripeCustomerId: 'cus_99999',
    }
    const summary = snapshotSummary(snapshot)
    expect(summary).not.toContain('secret_token_12345')
    expect(summary).not.toContain('cus_99999')
  })

  it('buildSupportSystem includes constants and rules', () => {
    const prompt = buildSupportSystem('Loyalty balances: Chase: 10,000 pts', true)
    expect(prompt).toContain(TIER_GREEN_CPP.toFixed(1))
    expect(prompt).toContain(TIER_AMBER_CPP.toFixed(1))
    expect(prompt).toContain(POINTS_THRESHOLD_CPP.toFixed(1))
    expect(prompt).toContain('NEVER calculate or invent numbers yourself')
    expect(prompt).toContain('NEVER multiply point balances by point valuations')
    expect(prompt).toContain('hop cannot modify, cancel, or refund tickets')
    expect(prompt).toContain('Account Context:')
  })

  it('buildSupportSystem for signed-out user enforces anonymous rules', () => {
    const prompt = buildSupportSystem('Signed out', false)
    expect(prompt).toContain('User is signed out.')
    expect(prompt).not.toContain('Account Context:')
  })
})
