// POST /api/balance-sync/ingest — the email rail of the balance-sync seam:
// the Cloudflare balance-sync Email Worker relays a forwarded loyalty email
// here (see cloudflare/balance-sync-worker/ and
// docs/plans/2026-07-05-balance-sync.md).
//
// AUTH, two independent layers:
//   1. A shared secret (HOP_BALANCE_INGEST_SECRET) as a Bearer token, compared
//      in CONSTANT TIME — no secret configured → 503, wrong/absent → 401
//      (the support-ingest pattern; this route writes and is public).
//   2. The user is resolved ONLY from the HMAC-signed personal sync address in
//      `to` (lib/balance-sync#resolveSyncAddress) — never from the spoofable
//      From: header. Bad signature → soft reject, nothing written.
//
// NEVER 500s — failures degrade to { ok:false } so the Worker's fire-and-forget
// POST can never block mail handling.

import { timingSafeEqual } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { env, hasEnv, isBalanceSyncEnabled, resolveAuthSecret } from '@/lib/env'
import { checkRateLimit, clientIp } from '@/lib/rate-limit'
import { getDb } from '@/lib/db'
import { user } from '@/lib/db/schema'
import {
  applyExtractedBalances,
  extractBalances,
  parseSyncAliasAddress,
  resolveSyncAddress,
  resolveSyncAlias,
  MAX_SYNC_TEXT_CHARS,
} from '@/lib/balance-sync'

export const runtime = 'nodejs'

// One authenticated machine caller (the Worker); throttle blunts a leaked-
// secret loop. Same shape as the support-ingest limit.
const INGEST_RATE = { capacity: 30, refillPerSec: 1 }
// Tighter, separate bucket for unresolved addresses — a scripted alias-guessing
// loop looks like a burst of "unknown address" misses, not normal mail relay
// traffic, so it gets throttled harder than the general limit and logged once
// it's clearly repeated (not on every single miss, which real typos also hit).
const UNKNOWN_ADDRESS_RATE = { capacity: 10, refillPerSec: 0.05 }

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
}

// Constant-time Bearer-token check (mirrors app/api/support-ingest's exported
// helper — kept local so the two ingest surfaces stay independently deletable).
export function isAuthorized(authHeader: string | null, secret: string): boolean {
  if (!secret) return false
  const prefix = 'Bearer '
  if (!authHeader || !authHeader.startsWith(prefix)) return false
  const provided = Buffer.from(authHeader.slice(prefix.length))
  const expected = Buffer.from(secret)
  if (provided.length !== expected.length) return false
  return timingSafeEqual(provided, expected)
}

interface IngestBody {
  to?: unknown
  subject?: unknown
  text?: unknown
}

export async function POST(request: Request): Promise<Response> {
  // The whole seam is flag-gated; a deployed Worker against a disabled app
  // must be a no-op, not a write.
  if (!isBalanceSyncEnabled()) return json({ ok: false, error: 'disabled' }, 503)
  if (!hasEnv('HOP_BALANCE_INGEST_SECRET')) {
    return json({ ok: false, error: 'unconfigured' }, 503)
  }
  if (!isAuthorized(request.headers.get('authorization'), env.balanceIngestSecret())) {
    return json({ ok: false, error: 'unauthorized' }, 401)
  }

  const ip = clientIp(request)
  if (!(await checkRateLimit(`balance-ingest:ip:${ip}`, INGEST_RATE)).ok) {
    return json({ ok: false, error: 'slow down' }, 429)
  }

  let body: IngestBody
  try {
    body = (await request.json()) as IngestBody
  } catch {
    return json({ ok: false, error: 'bad json' }, 400)
  }

  // Two address forms resolve to a user: the pretty DB alias (sync-<alias>@)
  // is tried first, then the legacy HMAC address (sync+<userId>.<sig>@).
  const to = typeof body.to === 'string' ? body.to : ''
  const alias = parseSyncAliasAddress(to)
  const userId =
    (alias ? await resolveSyncAlias(alias) : null) ?? resolveSyncAddress(to, resolveAuthSecret())
  if (!userId) {
    const unknown = await checkRateLimit(`balance-ingest:unknown:ip:${ip}`, UNKNOWN_ADDRESS_RATE)
    if (!unknown.ok) {
      console.warn(`[balance-sync-ingest] repeated unknown-address attempts from ip=${ip}`)
    }
    return json({ ok: false, error: 'unknown address' }, 404)
  }

  // The HMAC proves hop minted this address; still confirm the account exists
  // so a deleted user's forwards can't accumulate orphan rows.
  try {
    const db = getDb()
    if (!db) return json({ ok: false, error: 'unavailable' }, 503)
    const rows = await db.select({ id: user.id }).from(user).where(eq(user.id, userId)).limit(1)
    if (rows.length === 0) return json({ ok: false, error: 'unknown address' }, 404)
  } catch {
    return json({ ok: false, error: 'unavailable' }, 503)
  }

  const subject = typeof body.subject === 'string' ? body.subject : ''
  const text = typeof body.text === 'string' ? body.text : ''
  const input = `${subject}\n${text}`.slice(0, MAX_SYNC_TEXT_CHARS)
  if (input.trim().length < 8) return json({ ok: true, applied: null, note: 'empty' })

  // Extraction + clamp never throw; the email rail applies directly (there is
  // no one to confirm a preview) — the clamp is the safety: only balances the
  // email's own text vouches for can land, and re-forwards are idempotent.
  const { balances, source } = await extractBalances(input)
  if (balances.length === 0) return json({ ok: true, applied: null, note: 'no balances found' })
  const applied = await applyExtractedBalances(userId, balances)
  return json({ ok: true, applied, source })
}
