'use server'

import { revalidatePath } from 'next/cache'
import { auth0 } from '@/lib/auth0'
import { getPrefs } from '@/lib/prefs'
import { parseStandingOrder } from '@/lib/standing-orders-parser'
import {
  createStandingOrder,
  deleteStandingOrder,
  setStandingOrderActive,
} from '@/lib/standing-orders'
import { markAllAlertsSeen } from '@/lib/standing-order-alerts'
import { validateDraft } from '@/lib/standing-orders-model'

// Server Actions for the signed-in user's standing orders. Every action is gated
// by the Auth0 session and scoped to session.user.sub so one user can never touch
// another's watch. Returns a simple result for the client forms. Never throws.

type Result = { ok: boolean; error?: string; note?: string }

async function requireUser(): Promise<{ userId: string } | { error: string }> {
  const session = await auth0.getSession()
  const userId = session?.user?.sub
  if (!userId) return { error: 'Not signed in' }
  return { userId }
}

// Create a watch from plain-English text. Parses via the gateway (clamped),
// seeding the origin from the user's saved home airport. Refuses to persist a
// watch with no usable route. Returns a note so the UI can confirm what it heard.
export async function createWatch(text: string): Promise<Result> {
  const auth = await requireUser()
  if ('error' in auth) return { ok: false, error: auth.error }

  const raw = (text ?? '').trim()
  if (!raw) return { ok: false, error: 'Describe what to watch' }
  if (raw.length > 400) return { ok: false, error: 'Keep it under 400 characters' }

  // Seed the origin from the user's saved home airport when they omit it.
  const prefs = await getPrefs(auth.userId).catch(() => ({}))
  const home = 'homeAirport' in prefs ? prefs.homeAirport : undefined

  const draft = await parseStandingOrder(raw, { homeAirport: home })
  if (!draft) {
    return {
      ok: false,
      error: "Couldn't read a route. Try: \"watch SFO to NRT business 2026-03-25 above 2.5 cpp\".",
    }
  }

  const id = await createStandingOrder(auth.userId, draft)
  if (!id) return { ok: false, error: "Couldn't save — you may be at the watch limit." }

  revalidatePath('/account')
  const r = draft.params.return ? ` · returns ${draft.params.return}` : ''
  const cabin = draft.minCabin ? ` · ${draft.minCabin}` : ''
  return {
    ok: true,
    note: `Watching ${draft.params.from} → ${draft.params.to} on ${draft.params.depart}${r}${cabin} — ping above ${draft.minCpp} cpp.`,
  }
}

// Create a watch from explicit form fields (the structured fallback when the
// user prefers controls over prose). Validated/clamped before write.
export async function createWatchExplicit(input: {
  from: string
  to: string
  depart: string
  ret?: string
  adults?: number
  minCpp?: number
  minCabin?: string
}): Promise<Result> {
  const auth = await requireUser()
  if ('error' in auth) return { ok: false, error: auth.error }

  const draft = validateDraft({
    params: {
      from: input.from,
      to: input.to,
      depart: input.depart,
      return: input.ret || undefined,
      adults: input.adults ?? 1,
    },
    minCpp: input.minCpp,
    seats: input.adults ?? 1,
    minCabin: input.minCabin,
    eligiblePrograms: [],
  })
  if (!draft) return { ok: false, error: 'Enter a valid route and depart date.' }

  const id = await createStandingOrder(auth.userId, draft)
  if (!id) return { ok: false, error: "Couldn't save — you may be at the watch limit." }

  revalidatePath('/account')
  return { ok: true }
}

export async function pauseWatch(id: string, active: boolean): Promise<Result> {
  const auth = await requireUser()
  if ('error' in auth) return { ok: false, error: auth.error }
  if (!id) return { ok: false, error: 'Missing watch' }
  const ok = await setStandingOrderActive(auth.userId, id, active)
  if (!ok) return { ok: false, error: "Couldn't update — try again" }
  revalidatePath('/account')
  return { ok: true }
}

export async function removeWatch(id: string): Promise<Result> {
  const auth = await requireUser()
  if ('error' in auth) return { ok: false, error: auth.error }
  if (!id) return { ok: false, error: 'Missing watch' }
  const ok = await deleteStandingOrder(auth.userId, id)
  if (!ok) return { ok: false, error: "Couldn't remove — try again" }
  revalidatePath('/account')
  return { ok: true }
}

// Mark all of the user's alerts seen — called when the alerts surface mounts so
// the unseen badge clears.
export async function clearAlertBadge(): Promise<Result> {
  const auth = await requireUser()
  if ('error' in auth) return { ok: false, error: auth.error }
  await markAllAlertsSeen(auth.userId)
  revalidatePath('/account')
  return { ok: true }
}
