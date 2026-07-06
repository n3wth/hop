// Loyalty-credential vault — storage for the credential-based auto-sync rail
// ("hop signs in and reads your balance"). See docs/plans/2026-07-05-credential-sync.md.
//
// SECURITY CONTRACT:
//   - Username + password are encrypted as ONE AES-256-GCM blob per row, keyed
//     by HOP_CREDENTIAL_KEY (64-hex). Random 12-byte IV per encryption; the GCM
//     tag makes any tampering a hard decrypt failure.
//   - Plaintext exists only inside addCredential (inbound) and the cron's
//     decryptCredential call (lib/balance-autosync.ts). It is NEVER logged,
//     NEVER returned to the client (username_mask is the display form), and
//     NEVER leaves the server except to the fetch worker over the shared-
//     secret channel.
//   - No key → every function degrades to null/false. Fail closed.
//   - Every query is user_id-scoped in code (withDb; service role bypasses RLS).

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import { hasEnv, env } from '@/lib/env'
import { canonicalizeProgram } from '@/lib/programs'
import { withDb } from '@/lib/supabase-helpers'

const TABLE = 'hop_program_credentials'

export type CredentialStatus = 'pending' | 'ok' | 'failed' | 'unsupported'

// What the UI may see: no secret material, ever.
export interface CredentialRow {
  id: string
  program: string
  usernameMask: string
  status: CredentialStatus
  lastError: string | null
  lastSyncedAt: string | null
}

// --- Crypto ------------------------------------------------------------------

function getKey(): Buffer | null {
  if (!hasEnv('HOP_CREDENTIAL_KEY')) return null
  const hex = env.credentialKey().trim()
  if (!/^[0-9a-f]{64}$/i.test(hex)) return null
  return Buffer.from(hex, 'hex')
}

// iv.tag.ciphertext, each base64url. Null when no valid key. Never throws.
export function encryptCredential(username: string, password: string): string | null {
  const key = getKey()
  if (!key) return null
  try {
    const iv = randomBytes(12)
    const cipher = createCipheriv('aes-256-gcm', key, iv)
    const ct = Buffer.concat([
      cipher.update(JSON.stringify({ u: username, p: password }), 'utf8'),
      cipher.final(),
    ])
    const tag = cipher.getAuthTag()
    return [iv, tag, ct].map((b) => b.toString('base64url')).join('.')
  } catch {
    return null
  }
}

// Null on missing key, malformed blob, or GCM auth failure (tampering).
export function decryptCredential(blob: string): { username: string; password: string } | null {
  const key = getKey()
  if (!key || typeof blob !== 'string') return null
  const parts = blob.split('.')
  if (parts.length !== 3) return null
  try {
    const [iv, tag, ct] = parts.map((p) => Buffer.from(p, 'base64url'))
    const decipher = createDecipheriv('aes-256-gcm', key, iv)
    decipher.setAuthTag(tag)
    const plain = Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8')
    const parsed = JSON.parse(plain) as { u?: unknown; p?: unknown }
    if (typeof parsed.u !== 'string' || typeof parsed.p !== 'string') return null
    return { username: parsed.u, password: parsed.p }
  } catch {
    return null
  }
}

// Display-safe form: "ol…@newth.ai", "sk…er". Never the full identifier.
export function maskUsername(username: string): string {
  const at = username.indexOf('@')
  if (at > 0) return `${username.slice(0, Math.min(2, at))}…@${username.slice(at + 1)}`
  if (username.length <= 3) return `${username.slice(0, 1)}…`
  return `${username.slice(0, 2)}…${username.slice(-1)}`
}

// --- Store -------------------------------------------------------------------

// Save (or replace) the user's login for a program. The stored `program` is the
// canonical id when the name resolves (the fetch worker keys its recipes on
// it), else the trimmed free text. Returns false when the vault is off or the
// write fails — never throws.
export async function addCredential(
  userId: string,
  program: string,
  username: string,
  password: string,
): Promise<boolean> {
  const def = canonicalizeProgram(program)
  const programKey = def ? def.id : program.trim().toLowerCase()
  if (!programKey || !username.trim() || !password) return false
  const secretEnc = encryptCredential(username.trim(), password)
  if (!secretEnc) return false
  return withDb(false, async (db) => {
    const now = new Date().toISOString()
    const { error } = await db.from(TABLE).upsert(
      {
        user_id: userId,
        program: programKey,
        username_mask: maskUsername(username.trim()),
        secret_enc: secretEnc,
        status: 'pending',
        last_error: null,
        updated_at: now,
      },
      { onConflict: 'user_id,program' },
    )
    return !error
  })
}

export async function listCredentials(userId: string): Promise<CredentialRow[]> {
  return withDb<CredentialRow[]>([], async (db) => {
    const { data, error } = await db
      .from(TABLE)
      .select('id, program, username_mask, status, last_error, last_synced_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
    if (error || !data) return []
    /* eslint-disable @typescript-eslint/no-explicit-any */
    return (data as any[]).map((r) => ({
      id: r.id as string,
      program: r.program as string,
      usernameMask: r.username_mask as string,
      status: (r.status as CredentialStatus) ?? 'pending',
      lastError: (r.last_error as string | null) ?? null,
      lastSyncedAt: (r.last_synced_at as string | null) ?? null,
    }))
    /* eslint-enable @typescript-eslint/no-explicit-any */
  })
}

export async function removeCredential(userId: string, id: string): Promise<boolean> {
  return withDb(false, async (db) => {
    const { error } = await db.from(TABLE).delete().eq('id', id).eq('user_id', userId)
    return !error
  })
}

// --- Cron-side access (server only) -------------------------------------------

export interface DueCredential {
  id: string
  userId: string
  program: string
  secretEnc: string
}

// Credentials due a sync: never-synced first, then stale ones. Excludes rows
// already marked unsupported (a recipe change resets them via re-save).
export async function listDueCredentials(staleBefore: string, limit: number): Promise<DueCredential[]> {
  return withDb<DueCredential[]>([], async (db) => {
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const base = () =>
      db.from(TABLE).select('id, user_id, program, secret_enc').neq('status', 'unsupported')
    const [never, stale] = await Promise.all([
      base().is('last_synced_at', null).limit(limit),
      base().lt('last_synced_at', staleBefore).limit(limit),
    ])
    const rows = [...((never.data as any[]) ?? []), ...((stale.data as any[]) ?? [])]
    return rows.slice(0, limit).map((r) => ({
      id: r.id as string,
      userId: r.user_id as string,
      program: r.program as string,
      secretEnc: r.secret_enc as string,
    }))
    /* eslint-enable @typescript-eslint/no-explicit-any */
  })
}

// Stamp a sync outcome. `error` is truncated defensively — it may echo worker
// text and must stay a short, printable breadcrumb.
export async function recordSyncOutcome(
  id: string,
  status: CredentialStatus,
  error?: string,
): Promise<void> {
  await withDb(undefined, async (db) => {
    const now = new Date().toISOString()
    await db
      .from(TABLE)
      .update({
        status,
        last_error: error ? error.replace(/[^\x20-\x7E]/g, ' ').slice(0, 120) : null,
        last_synced_at: status === 'ok' ? now : undefined,
        updated_at: now,
      })
      .eq('id', id)
    return undefined
  })
}
