'use server'

import { revalidatePath } from 'next/cache'
import { auth0 } from '@/lib/auth0'
import {
  setUserAwId,
  clearUserAwId,
  addManualBalance,
  updateManualBalance,
  removeManualBalance,
  findManualByProgram,
  getManualBalances,
} from '@/lib/accounts'
import { canonicalizeProgram } from '@/lib/programs'
import { captureServerEvent } from '@/lib/posthog-server'

// Server Actions for the signed-in user's balance sources. Every action is gated
// by the Auth0 session and scoped to session.user.sub so one user can never touch
// another's data. Returns a simple result for the client forms. Never throws.

// `note` carries a human-readable confirmation when an action did something the
// user should know about (e.g. it folded a duplicate into an existing program).
type Result = { ok: boolean; error?: string; note?: string }

// Fold free-text onto the canonical registry so "amex" / "membership rewards" /
// typos all persist as ONE program identity. Returns the canonical display name
// and kind when we recognize it; otherwise keeps the user's trimmed input so we
// never lose a program we simply don't know about yet (degrade gracefully).
function canonicalizeEntry(input: string): { name: string; kind?: string } {
  const def = canonicalizeProgram(input)
  if (def) return { name: def.name, kind: def.kind }
  return { name: input.trim() }
}

const MAX_PROGRAM_LEN = 80
const MAX_AW_ID_LEN = 64
// A generous ceiling — the biggest real balances are in the low millions.
const MAX_BALANCE = 1_000_000_000

async function requireUser(): Promise<{ userId: string } | { error: string }> {
  const session = await auth0.getSession()
  const userId = session?.user?.sub
  if (!userId) return { error: 'Not signed in' }
  return { userId }
}

// Parse a balance from form input: strip commas/spaces, reject negatives/NaN.
function parseBalance(raw: unknown): number | null {
  const n = typeof raw === 'number' ? raw : parseFloat(String(raw ?? '').replace(/[^0-9.]/g, ''))
  if (!Number.isFinite(n) || n < 0 || n > MAX_BALANCE) return null
  return Math.round(n)
}

// --- Manual balances (primary path) ----------------------------------------

export async function addProgram(
  program: string,
  balanceRaw: string | number,
): Promise<Result> {
  const auth = await requireUser()
  if ('error' in auth) return { ok: false, error: auth.error }

  const raw = (program ?? '').trim()
  if (!raw) return { ok: false, error: 'Enter a program' }
  if (raw.length > MAX_PROGRAM_LEN) return { ok: false, error: 'That name is too long' }

  const balance = parseBalance(balanceRaw)
  if (balance == null) return { ok: false, error: 'Enter a valid balance' }

  // Canonicalize so the stored name is the one true program identity.
  const { name, kind } = canonicalizeEntry(raw)

  // Dedupe: if the user already holds this program (by canonical identity), fold
  // the new balance into the existing row instead of creating a duplicate, and
  // tell them what happened.
  const existing = await findManualByProgram(auth.userId, name)
  if (existing) {
    const merged = existing.balance + balance
    if (merged > MAX_BALANCE) return { ok: false, error: 'That balance is too large' }
    const ok = await updateManualBalance(auth.userId, existing.id, {
      program: name,
      balance: merged,
      kind,
    })
    if (!ok) return { ok: false, error: "Couldn't add — try again" }
    revalidateBalances()
    return {
      ok: true,
      note: `Added to your existing ${name} — now ${merged.toLocaleString()}.`,
    }
  }

  const id = await addManualBalance(auth.userId, name, balance, kind)
  if (!id) return { ok: false, error: "Couldn't add — try again" }

  // R0.5 funnel event #2 — first_program_added fires when this insert made the
  // user's first program row (the activation moment). Best-effort: a degraded
  // count read just skips the event, never the add.
  const programs = await getManualBalances(auth.userId)
  if (programs.length === 1) {
    captureServerEvent('first_program_added', {}, { distinctId: auth.userId })
  }

  revalidateBalances()
  return { ok: true }
}

export async function editProgram(
  id: string,
  program: string,
  balanceRaw: string | number,
): Promise<Result> {
  const auth = await requireUser()
  if ('error' in auth) return { ok: false, error: auth.error }

  if (!id) return { ok: false, error: 'Missing program' }
  const raw = (program ?? '').trim()
  if (!raw) return { ok: false, error: 'Enter a program' }
  if (raw.length > MAX_PROGRAM_LEN) return { ok: false, error: 'That name is too long' }

  const balance = parseBalance(balanceRaw)
  if (balance == null) return { ok: false, error: 'Enter a valid balance' }

  // Canonicalize the edited name onto the registry.
  const { name, kind } = canonicalizeEntry(raw)

  // Guard against an edit that collides with a DIFFERENT existing program — keep
  // each canonical identity to a single row. The user can remove one and re-add
  // to merge intentionally.
  const collision = await findManualByProgram(auth.userId, name)
  if (collision && collision.id !== id) {
    return { ok: false, error: `You already have ${name}. Edit that row instead.` }
  }

  const ok = await updateManualBalance(auth.userId, id, { program: name, balance, kind })
  if (!ok) return { ok: false, error: "Couldn't save — try again" }

  revalidateBalances()
  return { ok: true }
}

export async function removeProgram(id: string): Promise<Result> {
  const auth = await requireUser()
  if ('error' in auth) return { ok: false, error: auth.error }
  if (!id) return { ok: false, error: 'Missing program' }

  const ok = await removeManualBalance(auth.userId, id)
  if (!ok) return { ok: false, error: "Couldn't remove — try again" }

  revalidateBalances()
  return { ok: true }
}

// --- AwardWallet link (optional auto-sync) ----------------------------------

// Manual id entry — secondary/advanced escape hatch. The primary connect path is
// the OAuth handshake in app/auth/awardwallet/*. See that route for the flow.
export async function connectAwardWallet(awUserId: string): Promise<Result> {
  const auth = await requireUser()
  if ('error' in auth) return { ok: false, error: auth.error }

  const id = (awUserId ?? '').trim()
  if (!id) return { ok: false, error: 'Enter your AwardWallet ID' }
  if (id.length > MAX_AW_ID_LEN) return { ok: false, error: "That ID doesn't look right" }

  const saved = await setUserAwId(auth.userId, id)
  if (!saved) return { ok: false, error: "Couldn't connect — try again" }

  revalidateBalances()
  return { ok: true }
}

export async function disconnectAwardWallet(): Promise<Result> {
  const auth = await requireUser()
  if ('error' in auth) return { ok: false, error: auth.error }

  const cleared = await clearUserAwId(auth.userId)
  if (!cleared) return { ok: false, error: "Couldn't disconnect — try again" }

  revalidateBalances()
  return { ok: true }
}

// --- Gmail travel-history seam ---------------------------------------------

// Disconnect Gmail: revokes our token upstream + deletes the stored trips and
// refresh token. Gated by the Auth0 session and scoped to the user's sub.
export async function disconnectGmailHistory(): Promise<Result> {
  const auth = await requireUser()
  if ('error' in auth) return { ok: false, error: auth.error }

  const { disconnectGmail } = await import('@/lib/travel-history-sync')
  const cleared = await disconnectGmail(auth.userId)
  if (!cleared) return { ok: false, error: "Couldn't disconnect — try again" }

  revalidateBalances()
  return { ok: true }
}

// Re-read confirmation emails and refresh the stored trips on demand.
export async function resyncGmailHistory(): Promise<Result> {
  const auth = await requireUser()
  if ('error' in auth) return { ok: false, error: auth.error }

  const { syncTravelHistory } = await import('@/lib/travel-history-sync')
  const count = await syncTravelHistory(auth.userId)
  revalidateBalances()
  return { ok: true, note: `Synced ${count} trip${count === 1 ? '' : 's'} from Gmail.` }
}

// --- Account deletion (the /privacy promise) ---------------------------------

// Deletes every row we hold for the signed-in user (lib/account-deletion.ts),
// including their Better Auth identity — the session cookie dies with the
// session rows. The client redirects home on ok. Gated on the live session
// like every other action here; never throws.
export async function deleteAccount(): Promise<Result> {
  const auth = await requireUser()
  if ('error' in auth) return { ok: false, error: auth.error }

  const { deleteUserAccount } = await import('@/lib/account-deletion')
  const result = await deleteUserAccount(auth.userId)
  if (!result.ok) return { ok: false, error: result.error ?? "Couldn't delete — try again" }
  return { ok: true }
}

// Pages whose output depends on the user's balances.
function revalidateBalances(): void {
  revalidatePath('/account')
  revalidatePath('/')
  revalidatePath('/deals')
  revalidatePath('/ask')
}
