// POST /api/support-ingest — files an inbound support email (relayed by the
// Cloudflare support@hop.flights Email Worker) as a ticket in hop_support_tickets.
//
// AUTH: a shared secret (HOP_SUPPORT_INGEST_SECRET) presented as a Bearer token,
// compared in CONSTANT TIME. This endpoint WRITES and is reachable from the public
// internet, so — unlike the optional-auth concierge routes — it rejects anything
// unauthenticated: no secret configured → 503; wrong/absent token → 401. Light
// per-IP rate limit on top. Idempotent on the Message-ID. NEVER 500s — a failure
// degrades to a soft {ok:false} so the Worker's fire-and-forget POST can never
// block the email reply/forward.

import { timingSafeEqual } from 'node:crypto'
import { env, hasEnv } from '@/lib/env'
import { checkRateLimit, clientIp } from '@/lib/rate-limit'
import { createSupportTicket } from '@/lib/support-tickets'

export const runtime = 'nodejs'

// One authenticated machine caller (the Worker), but it writes a row, so still
// throttle to blunt a leaked-secret loop. Generous vs the concierge limits.
const INGEST_RATE = { capacity: 30, refillPerSec: 1 } // 30 burst, ~60/min sustained

interface IngestBody {
  from?: unknown
  to?: unknown
  subject?: unknown
  text?: unknown
  messageId?: unknown
  receivedAt?: unknown
}

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
}

// Constant-time Bearer-token check against the configured secret. Returns false
// for a missing / malformed / wrong-length / mismatched token (and when no secret
// is configured). Exported for unit testing. Pure.
export function isAuthorized(authHeader: string | null, secret: string): boolean {
  if (!secret) return false
  const prefix = 'Bearer '
  if (!authHeader || !authHeader.startsWith(prefix)) return false
  const provided = Buffer.from(authHeader.slice(prefix.length))
  const expected = Buffer.from(secret)
  // Length is not secret; bail early (timingSafeEqual throws on length mismatch).
  if (provided.length !== expected.length) return false
  return timingSafeEqual(provided, expected)
}

export async function POST(request: Request): Promise<Response> {
  // No secret configured → the endpoint is closed. Never accept an unauthenticated
  // write on a publicly-reachable route.
  if (!hasEnv('HOP_SUPPORT_INGEST_SECRET')) {
    return json({ ok: false, error: 'unconfigured' }, 503)
  }
  if (!isAuthorized(request.headers.get('authorization'), env.supportIngestSecret())) {
    return json({ ok: false, error: 'unauthorized' }, 401)
  }

  const ip = clientIp(request)
  if (!(await checkRateLimit(`ingest:ip:${ip}`, INGEST_RATE)).ok) {
    return json({ ok: false, error: 'slow down' }, 429)
  }

  let body: IngestBody
  try {
    body = (await request.json()) as IngestBody
  } catch {
    return json({ ok: false, error: 'bad json' }, 400)
  }

  const from = typeof body?.from === 'string' ? body.from : ''
  if (!from) return json({ ok: false, error: 'missing from' }, 400)

  const str = (v: unknown) => (typeof v === 'string' ? v : undefined)
  const ok = await createSupportTicket({
    from,
    to: str(body?.to),
    subject: str(body?.subject),
    text: str(body?.text),
    messageId: str(body?.messageId),
    receivedAt: str(body?.receivedAt),
  })
  // Soft failure (unconfigured db / bad sender / write error) — never 500.
  if (!ok) return json({ ok: false, error: 'not stored' }, 200)
  return json({ ok: true })
}
