// GET /api/search — parse SearchParams from the query string, assemble the
// full SearchResult, and return it as JSON. The assembler never throws and
// degrades gracefully on upstream failure; non-200 only for bot denials (403)
// and rate limits (429) — this route fans out to two paid upstreams, so
// unmetered access is cost amplification.

import { checkBotId } from 'botid/server'
import type { SearchParams } from '@/lib/types'
import { assembleSearch } from '@/lib/search'
import { auth0 } from '@/lib/auth0'
import { getUserBalances } from '@/lib/accounts'
import { getPrefs } from '@/lib/prefs'
import { checkRateLimit, clientIp } from '@/lib/rate-limit'
import { clampTravelDates } from '@/lib/travel-dates'

const SEARCH_RATE = { capacity: 10, refillPerSec: 0.2 } // 10 burst, ~12/min sustained

// Parse a non-negative passenger count, clamped to [0, max]. Bad input → 0.
function parseCount(raw: string | null, max: number): number {
  const n = parseInt(raw ?? '', 10)
  if (!Number.isFinite(n) || n <= 0) return 0
  return Math.min(max, n)
}

const CABINS = ['economy', 'premium', 'business', 'first'] as const
// Validate the cabin query param against our enum. Unknown/absent → undefined
// (the engine defaults to economy, the legacy behavior).
function parseCabin(raw: string | null): SearchParams['cabin'] {
  const c = (raw ?? '').trim().toLowerCase()
  return (CABINS as readonly string[]).includes(c) ? (c as SearchParams['cabin']) : undefined
}

function parseParams(url: URL): SearchParams {
  const q = url.searchParams
  const adults = parseInt(q.get('adults') ?? '', 10)
  const children = parseCount(q.get('children'), 8)
  const infants = parseCount(q.get('infants'), 8)
  // Same rolling clamp as /search — missing/malformed/past dates never run a
  // permanently stale default; absent return means one-way.
  const { depart, return: ret } = clampTravelDates(
    q.get('depart') ?? undefined,
    q.get('return') ?? undefined,
  )
  return {
    from: (q.get('from') ?? 'SFO').trim().toUpperCase(),
    to: (q.get('to') ?? 'LAX').trim().toUpperCase(),
    depart,
    return: ret,
    adults: Number.isFinite(adults) && adults > 0 ? adults : 1,
    // Omit when zero/absent so the URL stays backward-compatible (adults-only).
    ...(children > 0 ? { children } : {}),
    ...(infants > 0 ? { infants } : {}),
    cabin: parseCabin(q.get('cabin')),
  }
}

export async function GET(request: Request) {
  const verification = await checkBotId()
  if (verification.isBot) {
    return Response.json({ ok: false, error: 'Access denied' }, { status: 403 })
  }

  // Rate limit before any upstream fan-out. Keyed per-IP like /api/dream.
  const limit = await checkRateLimit(`search:ip:${clientIp(request)}`, SEARCH_RATE)
  if (!limit.ok) {
    return Response.json(
      { ok: false, error: 'rate-limited' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSec) } },
    )
  }

  const params = parseParams(new URL(request.url))
  // Signed in → ground in this user's real balances (manual + AwardWallet);
  // signed out → undefined keeps the env-global/mock fallback in assembleSearch.
  const session = await auth0.getSession()
  const sub = session?.user?.sub
  // Stored travel prefs re-rank the verdict, remembered like the home airport.
  const [userBalances, prefs] = await Promise.all([
    sub ? getUserBalances(sub) : Promise.resolve(undefined),
    sub ? getPrefs(sub) : Promise.resolve(undefined),
  ])
  const result = await assembleSearch(params, userBalances, prefs?.travelPrefs)
  return Response.json(result)
}
