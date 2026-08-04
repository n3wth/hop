'use server'

// Server action for the concierge's verdict cards. The only capability is
// DISMISS — "Not for me" — which records an OBSERVED outcome (a destination the
// traveler passed on) so hop learns to stop leading with it. It writes nothing to
// the stated profile and asserts no economics; it's a soft signal the aggregator
// (lib/memory-outcomes.ts) only acts on once it RECURS.
//
// Auth0 sub-scoped (signed-out → no-op) and gated + withDb-graceful (inherited
// from recordOutcome, which never throws). Ships dark until the observed-outcomes
// seam is enabled, so this is a no-op until then.

import { auth0 } from '@/lib/auth0'
import { recordOutcome } from '@/lib/memory-outcomes'

export interface DismissResult {
  ok: boolean
}

// Record that the user dismissed a destination verdict. `subject` is the human
// place label they saw (city, or the IATA code as a fallback); `cabin` is optional
// context. A no-op (signed out, seam off, empty subject) returns { ok:false }.
export async function dismissVerdict(subject: string, cabin?: string): Promise<DismissResult> {
  const sub = (await auth0.getSession())?.user?.sub
  if (!sub) return { ok: false }
  const ok = await recordOutcome(sub, { kind: 'dismissed_verdict', subject, cabin })
  return { ok }
}
