// Ops preflight — the single answer to "are the lights on?" (roadmap R0.4).
// Composes the health-checks flag/key registry with the handful of seams that
// live outside it (cron auth, auth secret, email, analytics, MOCK) into one
// serializable table for /admin/ops. Presence-only: no secret VALUES are ever
// read into the rows, only whether something is set. Pure read — computing
// the table changes nothing. SERVER ONLY.
//
// CRON_SECRET / BETTER_AUTH_SECRET / AUTH_SECRET / MOCK are read from
// process.env directly (presence only): none is a lib/env.ts EnvKey — cron
// auth deliberately reads raw (lib/cron-auth.ts), the auth secret has its own
// resolution chain (lib/env.ts#resolveAuthSecret), and MOCK is the fixture
// switch lib/search.ts parses inline.

import { FLAG_REQUIREMENTS, gatherFlagSeamInputs } from '@/lib/health-checks'
import {
  hasEnv,
  isPostHogEnabled,
  isSelfImproveEnabled,
  isStandingOrdersCronLive,
} from '@/lib/env'
import { isEmailEnabled } from '@/lib/email'

export type PreflightStatus = 'on' | 'off' | 'drift' | 'warn'

export interface PreflightRow {
  /** Display name for the seam. */
  seam: string
  status: PreflightStatus
  /** One line of state: what's on, what's missing, what that means. */
  detail: string
}

const set = (name: string): boolean => {
  const v = process.env[name]
  return typeof v === 'string' && v.trim() !== ''
}

const FLAG_SEAM_NAMES: Record<string, string> = {
  HOP_ENABLE_CHECKOUT: 'Native checkout (Duffel)',
  HOP_ENABLE_GMAIL_HISTORY: 'Gmail travel history',
  HOP_ENABLE_VALUATION_SYNC: 'Valuation sync (worker)',
  HOP_ENABLE_BILLING: 'Billing (Stripe)',
}

export function gatherOpsPreflight(): PreflightRow[] {
  const rows: PreflightRow[] = []

  // Flag+key seams from the registry the health sentinel audits (D3).
  const inputs = gatherFlagSeamInputs()
  for (const seam of FLAG_REQUIREMENTS) {
    const input = inputs.find((i) => i.flag === seam.flag)
    if (!input) continue
    const name = FLAG_SEAM_NAMES[seam.flag] ?? seam.flag
    if (input.flagOn && input.missingKeys.length > 0) {
      rows.push({
        seam: name,
        status: 'drift',
        detail: `${seam.flag} on but missing ${input.missingKeys.join(', ')}`,
      })
    } else if (input.flagOn) {
      rows.push({ seam: name, status: 'on', detail: `${seam.flag} on, keys present` })
    } else {
      rows.push({ seam: name, status: 'off', detail: `${seam.flag} off` })
    }
  }

  // Standing-order alerts — the retention loop. Email delivery additionally
  // needs Resend; without it a live cron only writes in-app alerts.
  const watchesLive = isStandingOrdersCronLive()
  const emailLive = isEmailEnabled()
  rows.push({
    seam: 'Watch alerts (standing orders)',
    status: watchesLive ? (emailLive ? 'on' : 'warn') : 'off',
    detail: watchesLive
      ? emailLive
        ? 'cron live, email delivery configured'
        : 'cron live but RESEND_API_KEY unset — in-app alerts only'
      : 'STANDING_ORDERS_CRON_ENABLED off — watches saved, never checked',
  })

  rows.push({
    seam: 'Self-improvement loop',
    status: isSelfImproveEnabled() ? 'on' : 'off',
    detail: isSelfImproveEnabled()
      ? 'HOP_ENABLE_SELF_IMPROVE on — sentinel, digests, findings live'
      : 'HOP_ENABLE_SELF_IMPROVE off — health reads return null',
  })

  rows.push({
    seam: 'Email (Resend)',
    status: emailLive ? 'on' : 'warn',
    detail: emailLive
      ? 'RESEND_API_KEY set'
      : 'RESEND_API_KEY unset — alert/digest/owner emails cannot send',
  })

  rows.push({
    seam: 'Cron auth',
    status: set('CRON_SECRET') ? 'on' : 'warn',
    detail: set('CRON_SECRET')
      ? 'CRON_SECRET set'
      : 'CRON_SECRET unset — every cron 503s in production (fails closed)',
  })

  const explicitSecret = set('BETTER_AUTH_SECRET') || set('AUTH_SECRET')
  rows.push({
    seam: 'Auth secret',
    status: explicitSecret ? 'on' : set('DATABASE_URL') ? 'warn' : 'drift',
    detail: explicitSecret
      ? 'explicit BETTER_AUTH_SECRET/AUTH_SECRET set'
      : set('DATABASE_URL')
        ? 'derived from DATABASE_URL — set BETTER_AUTH_SECRET (rotating the db URL would end every session)'
        : 'no secret and no DATABASE_URL — auth is dark',
  })

  rows.push({
    seam: 'Product analytics (PostHog)',
    status: isPostHogEnabled() ? 'on' : 'warn',
    detail: isPostHogEnabled()
      ? 'key set — funnel events + degradation telemetry flowing'
      : 'no PostHog key — the five funnel events are dark',
  })

  rows.push({
    seam: 'AwardWallet connect',
    status: hasEnv('AWARDWALLET_CONNECT_URL') ? 'on' : 'off',
    detail: hasEnv('AWARDWALLET_CONNECT_URL')
      ? 'connect URL configured'
      : 'AWARDWALLET_CONNECT_URL unset — balance auto-sync unavailable, manual entry only',
  })

  const mockOn = /^(1|true|yes)$/i.test((process.env.MOCK ?? '').trim())
  rows.push({
    seam: 'Mock fixtures',
    status: mockOn ? 'warn' : 'on',
    detail: mockOn
      ? 'MOCK is ON — cash/awards/balances come from fixtures, not live upstreams'
      : 'live upstreams (MOCK off)',
  })

  return rows
}

/** Seams that need attention (drift or warn) — the overview badge count. */
export function countPreflightIssues(rows: PreflightRow[]): number {
  return rows.filter((r) => r.status === 'drift' || r.status === 'warn').length
}
