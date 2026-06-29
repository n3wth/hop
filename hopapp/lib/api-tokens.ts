// Per-user hop API tokens — the linking story for the MCP server ("Add to
// Claude"). A token maps an opaque bearer string to one Auth0 user (sub) so the
// MCP tools can load THAT user's real balances via getUserBalances. Tokens are
// stored HASHED (SHA-256) — the plaintext is shown exactly once at mint time and
// never persisted, so a leaked row can't be replayed.
//
// Persistence is the service-role Supabase client (server-only), scoped by the
// Auth0 sub in code — same pattern as the rest of lib/accounts. Every function
// degrades gracefully and never throws to a route handler.

import { createHash, randomBytes } from 'node:crypto'
import { supabaseAdmin } from '@/utils/supabase/admin'

// Plaintext tokens are prefixed so they're recognizable in logs / config and so
// a quick shape check can reject obvious garbage before a DB round-trip.
export const TOKEN_PREFIX = 'hop_'
const RANDOM_BYTES = 32 // 256 bits of entropy, base64url-encoded.

// SHA-256 hex of the plaintext token. Deterministic so lookup is a single
// indexed equality match. Tokens are high-entropy opaque secrets (not
// user-chosen passwords), so a fast hash is the right tool — bcrypt/argon would
// only add latency without adding meaningful resistance at this entropy.
export function hashToken(plaintext: string): string {
  return createHash('sha256').update(plaintext, 'utf8').digest('hex')
}

// Generate a fresh opaque token: prefix + base64url(32 random bytes).
export function generateToken(): string {
  return TOKEN_PREFIX + randomBytes(RANDOM_BYTES).toString('base64url')
}

// Cheap shape gate before hashing/lookup — rejects empty / wrong-prefix strings.
export function looksLikeToken(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith(TOKEN_PREFIX) && value.length > TOKEN_PREFIX.length + 20
}

// A token row as surfaced to the owner's UI — NEVER includes the hash or the
// plaintext. `lastFour` is a display hint so the user can tell tokens apart.
export interface ApiTokenInfo {
  id: string
  name: string | null
  lastFour: string
  createdAt: string | null
  lastUsedAt: string | null
}

const TABLE = 'hop_api_tokens'

// Last 4 chars of the plaintext — a display hint, safe to store unhashed.
function lastFourOf(plaintext: string): string {
  return plaintext.slice(-4)
}

// Mint a new token for a user. Returns the PLAINTEXT once (caller must show it
// immediately; it's unrecoverable after) plus the stored row info, or null on
// failure. Only the hash + last-four are persisted.
export async function mintToken(
  userId: string,
  name?: string,
): Promise<{ token: string; info: ApiTokenInfo } | null> {
  try {
    const db = supabaseAdmin()
    if (!db) return null
    const token = generateToken()
    const now = new Date().toISOString()
    const { data, error } = await db
      .from(TABLE)
      .insert({
        user_id: userId,
        token_hash: hashToken(token),
        last_four: lastFourOf(token),
        name: name?.trim() || null,
        created_at: now,
      })
      .select('id, name, last_four, created_at, last_used_at')
      .single()
    if (error || !data) return null
    return {
      token,
      info: {
        id: data.id,
        name: data.name,
        lastFour: data.last_four,
        createdAt: data.created_at,
        lastUsedAt: data.last_used_at,
      },
    }
  } catch {
    return null
  }
}

// List a user's active tokens (no secrets). Scoped by user_id in code.
export async function listTokens(userId: string): Promise<ApiTokenInfo[]> {
  try {
    const db = supabaseAdmin()
    if (!db) return []
    const { data, error } = await db
      .from(TABLE)
      .select('id, name, last_four, created_at, last_used_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    if (error || !data) return []
    return data.map((r) => ({
      id: r.id,
      name: r.name,
      lastFour: r.last_four,
      createdAt: r.created_at,
      lastUsedAt: r.last_used_at,
    }))
  } catch {
    return []
  }
}

// Revoke (hard-delete) a token by id, scoped to its owner so a user can only
// revoke their OWN tokens. Returns whether a row was removed.
export async function revokeToken(userId: string, tokenId: string): Promise<boolean> {
  try {
    const db = supabaseAdmin()
    if (!db) return false
    const { error, count } = await db
      .from(TABLE)
      .delete({ count: 'exact' })
      .eq('user_id', userId)
      .eq('id', tokenId)
    return !error && (count ?? 0) > 0
  } catch {
    return false
  }
}

// Resolve a PLAINTEXT bearer token to its owner's Auth0 sub, or null if unknown.
// This is the MCP server's auth primitive: hash the presented token, look up the
// row, return the user_id. Best-effort updates last_used_at for the UI.
export async function userIdForToken(plaintext: string): Promise<string | null> {
  try {
    if (!looksLikeToken(plaintext)) return null
    const db = supabaseAdmin()
    if (!db) return null
    const hash = hashToken(plaintext)
    const { data, error } = await db
      .from(TABLE)
      .select('id, user_id')
      .eq('token_hash', hash)
      .maybeSingle()
    if (error || !data) return null
    // Fire-and-forget freshness stamp; never block auth on it.
    void db
      .from(TABLE)
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', data.id)
      .then(() => undefined)
    return data.user_id
  } catch {
    return null
  }
}
