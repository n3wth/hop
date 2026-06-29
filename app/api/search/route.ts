// GET /api/search — parse SearchParams from the query string, assemble the
// full SearchResult, and return it as JSON. Always responds 200; the assembler
// never throws and degrades gracefully on upstream failure.

import type { SearchParams } from '@/lib/types'
import { assembleSearch } from '@/lib/search'
import { auth0 } from '@/lib/auth0'
import { getUserBalances } from '@/lib/accounts'
import { getPrefs } from '@/lib/prefs'

function parseParams(url: URL): SearchParams {
  const q = url.searchParams
  const adults = parseInt(q.get('adults') ?? '', 10)
  const ret = q.get('return')
  return {
    from: (q.get('from') ?? 'SFO').trim().toUpperCase(),
    to: (q.get('to') ?? 'LAX').trim().toUpperCase(),
    depart: q.get('depart') ?? '2026-07-09',
    return: ret ?? '2026-07-12',
    adults: Number.isFinite(adults) && adults > 0 ? adults : 1,
  }
}

export async function GET(request: Request) {
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
