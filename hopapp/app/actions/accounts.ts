'use server'

import { revalidatePath } from 'next/cache'
import { auth0 } from '@/lib/auth0'
import {
  setUserAwId,
  clearUserAwId,
  addManualBalance,
  updateManualBalance,
  removeManualBalance,
} from '@/lib/accounts'

// Server Actions for the signed-in user's balance sources. Every action is gated
// by the Auth0 session and scoped to session.user.sub so one user can never touch
// another's data. Returns a simple result for the client forms. Never throws.

type Result = { ok: boolean; error?: string }

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

  const name = (program ?? '').trim()
  if (!name) return { ok: false, error: 'Enter a program' }
  if (name.length > MAX_PROGRAM_LEN) return { ok: false, error: 'That name is too long' }

  const balance = parseBalance(balanceRaw)
  if (balance == null) return { ok: false, error: 'Enter a valid balance' }

  const id = await addManualBalance(auth.userId, name, balance)
  if (!id) return { ok: false, error: "Couldn't add — try again" }

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
  const name = (program ?? '').trim()
  if (!name) return { ok: false, error: 'Enter a program' }
  if (name.length > MAX_PROGRAM_LEN) return { ok: false, error: 'That name is too long' }

  const balance = parseBalance(balanceRaw)
  if (balance == null) return { ok: false, error: 'Enter a valid balance' }

  const ok = await updateManualBalance(auth.userId, id, { program: name, balance })
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

// Pages whose output depends on the user's balances.
function revalidateBalances(): void {
  revalidatePath('/account')
  revalidatePath('/')
  revalidatePath('/deals')
  revalidatePath('/ask')
}
