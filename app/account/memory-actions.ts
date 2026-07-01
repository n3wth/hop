'use server'

// Server actions for the "What hop knows about you" glass box. The only
// destructive capability is FORGET — remove a durable fact hop holds. It reads
// the stored profile, drops the field (or a single list entry), and writes the
// result back through setProfile, which re-clamps via validateProfile — so a
// forget can never poison the profile, only shrink it.
//
// Auth0 sub-scoped (signed-out → no-op) and withDb-graceful (inherited from
// get/setProfile, which never throw). revalidatePath refreshes /account so the
// row disappears immediately.

import { revalidatePath } from 'next/cache'
import { auth0 } from '@/lib/auth0'
import { getProfile, setProfile } from '@/lib/travel-profile'
import {
  confirmInferredFact,
  dismissInferredFact,
  type InferredActionResult,
} from '@/lib/inferred-facts'
import type { TravelProfile } from '@/lib/travel-profile-model'
import type { MemoryKind } from '@/lib/memory-view'

// Map a list kind → the profile field holding its entries.
const LIST_FIELDS: Partial<Record<MemoryKind, keyof TravelProfile>> = {
  dietary: 'dietary',
  accessibility: 'accessibility',
  lovedDestinations: 'lovedDestinations',
  avoidedDestinations: 'avoidedDestinations',
}

const SCALAR_FIELDS: Partial<Record<MemoryKind, keyof TravelProfile>> = {
  vacationDays: 'vacationDays',
  travelParty: 'travelParty',
  cabin: 'cabin',
}

export interface ForgetResult {
  ok: boolean
}

// Forget one fact. For a scalar kind, `entry` is ignored and the whole field is
// cleared. For a list kind, only the matching entry is removed (case-insensitive)
// and the rest of the list is kept. A no-op (signed out, unknown kind, nothing to
// remove) returns { ok: false } without writing.
export async function forgetFact(kind: MemoryKind, entry?: string): Promise<ForgetResult> {
  const session = await auth0.getSession()
  const sub = session?.user?.sub
  if (!sub) return { ok: false }

  const profile = await getProfile(sub)
  const next: TravelProfile = { ...profile }

  const scalar = SCALAR_FIELDS[kind]
  const list = LIST_FIELDS[kind]

  if (scalar) {
    if (next[scalar] === undefined) return { ok: false }
    delete next[scalar]
  } else if (list) {
    const current = next[list]
    if (!Array.isArray(current) || !entry) return { ok: false }
    const want = entry.trim().toLowerCase()
    const kept = (current as string[]).filter((v) => v.trim().toLowerCase() !== want)
    if (kept.length === current.length) return { ok: false } // nothing matched
    if (kept.length === 0) {
      delete next[list]
    } else {
      ;(next[list] as string[]) = kept
    }
  } else {
    return { ok: false } // unknown / non-forgettable kind (e.g. airlineStatuses)
  }

  const ok = await setProfile(sub, next)
  if (ok) revalidatePath('/account')
  return { ok }
}

// Confirm an inferred "hop noticed …" suggestion → promote it into the stated
// profile and mark it confirmed. Auth0-scoped; no-op when signed out.
export async function confirmInference(id: string): Promise<InferredActionResult> {
  const sub = (await auth0.getSession())?.user?.sub
  if (!sub) return { ok: false }
  const res = await confirmInferredFact(sub, id)
  if (res.ok) revalidatePath('/account')
  return res
}

// Dismiss an inferred suggestion → mark rejected so it's never re-proposed.
export async function dismissInference(id: string): Promise<InferredActionResult> {
  const sub = (await auth0.getSession())?.user?.sub
  if (!sub) return { ok: false }
  const res = await dismissInferredFact(sub, id)
  if (res.ok) revalidatePath('/account')
  return res
}
