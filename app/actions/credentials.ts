'use server'

import { revalidatePath } from 'next/cache'
import { auth0 } from '@/lib/auth0'
import { isCredentialSyncEnabled } from '@/lib/env'
import { addCredential, removeCredential } from '@/lib/credential-vault'

// Server Actions for the credential-based auto-sync rail ("hop signs in and
// reads your balance"). Every action is gated by BOTH the session AND
// isCredentialSyncEnabled() (flag + vault key) — a login can never be stored
// unless the vault can actually encrypt it. Scoped to session.user.sub. The
// password reaches ONLY lib/credential-vault (encrypted at rest); it is never
// returned to the client and never logged. Never throws.

type Result = { ok: boolean; error?: string }

const MAX_PROGRAM_LEN = 80
const MAX_USERNAME_LEN = 160
const MAX_PASSWORD_LEN = 256

async function requireUser(): Promise<{ userId: string } | { error: string }> {
  const session = await auth0.getSession()
  const userId = session?.user?.sub
  if (!userId) return { error: 'Not signed in' }
  return { userId }
}

export async function addProgramLogin(
  program: string,
  username: string,
  password: string,
): Promise<Result> {
  if (!isCredentialSyncEnabled()) return { ok: false, error: 'Auto-sync isn’t available yet' }
  const auth = await requireUser()
  if ('error' in auth) return { ok: false, error: auth.error }

  const prog = (program ?? '').trim()
  const user = (username ?? '').trim()
  const pass = password ?? ''
  if (!prog) return { ok: false, error: 'Pick a program' }
  if (prog.length > MAX_PROGRAM_LEN) return { ok: false, error: 'That name is too long' }
  if (!user) return { ok: false, error: 'Enter your username' }
  if (user.length > MAX_USERNAME_LEN) return { ok: false, error: 'That username is too long' }
  if (!pass) return { ok: false, error: 'Enter your password' }
  if (pass.length > MAX_PASSWORD_LEN) return { ok: false, error: 'That password is too long' }

  const ok = await addCredential(auth.userId, prog, user, pass)
  if (!ok) return { ok: false, error: "Couldn't save — try again" }

  revalidatePath('/account')
  return { ok: true }
}

export async function removeProgramLogin(id: string): Promise<Result> {
  if (!isCredentialSyncEnabled()) return { ok: false, error: 'Auto-sync isn’t available yet' }
  const auth = await requireUser()
  if ('error' in auth) return { ok: false, error: auth.error }
  if (!id) return { ok: false, error: 'Missing login' }

  const ok = await removeCredential(auth.userId, id)
  if (!ok) return { ok: false, error: "Couldn't remove — try again" }

  revalidatePath('/account')
  return { ok: true }
}
