// POST /api/balance-sync — the paste rail of the balance-sync seam (see
// docs/plans/2026-07-05-balance-sync.md). Session-authed. Two modes:
//
//   { mode: 'preview', text }            → what hop read, nothing written
//   { mode: 'apply',   text, balances }  → upsert the CONFIRMED entries
//
// Apply re-clamps the submitted entries against the same source text
// (validateExtracted), so exactly what the user previewed is what lands —
// nothing the text can't vouch for ever reaches the DB. NEVER 500s: failures
// degrade to soft { ok:false } responses.

import { getUserId } from '@/lib/session'
import { isBalanceSyncEnabled } from '@/lib/env'
import { checkRateLimit } from '@/lib/rate-limit'
import {
  applyExtractedBalances,
  extractBalances,
  validateExtracted,
  MAX_SYNC_TEXT_CHARS,
} from '@/lib/balance-sync'

export const runtime = 'nodejs'

// Preview may spend a gateway call — keep bursts short per user.
const SYNC_RATE = { capacity: 6, refillPerSec: 0.05 } // 6 burst, ~3/min sustained

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
}

interface SyncBody {
  mode?: unknown
  text?: unknown
  balances?: unknown
}

export async function POST(request: Request): Promise<Response> {
  if (!isBalanceSyncEnabled()) {
    return json({ ok: false, error: 'unavailable' }, 503)
  }
  const userId = await getUserId()
  if (!userId) return json({ ok: false, error: 'sign in required' }, 401)

  if (!(await checkRateLimit(`balance-sync:${userId}`, SYNC_RATE)).ok) {
    return json({ ok: false, error: 'slow down' }, 429)
  }

  let body: SyncBody
  try {
    body = (await request.json()) as SyncBody
  } catch {
    return json({ ok: false, error: 'bad json' }, 400)
  }

  const text = typeof body.text === 'string' ? body.text.slice(0, MAX_SYNC_TEXT_CHARS) : ''
  if (text.trim().length < 8) {
    return json({ ok: false, error: 'paste the text that shows your balance' }, 400)
  }

  try {
    if (body.mode === 'apply') {
      // Re-clamp the confirmed entries against the source text — the client's
      // list is a proposal, never trusted directly.
      const confirmed = validateExtracted({ balances: body.balances }, text)
      if (!confirmed) return json({ ok: false, error: 'nothing to apply' }, 400)
      const applied = await applyExtractedBalances(userId, confirmed)
      return json({ ok: true, applied })
    }
    const { balances, source } = await extractBalances(text)
    return json({ ok: true, balances, source })
  } catch {
    // extractBalances/apply never throw by contract; this is belt-and-braces.
    return json({ ok: false, error: 'could not read that' }, 200)
  }
}
