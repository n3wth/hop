// GET /api/awards — thin debugging handler for the award facade (chart-cpp).

import type { SearchParams } from '@/lib/types'
import { searchAwards } from '@/lib/awards'
import { clampTravelDates } from '@/lib/travel-dates'

export async function GET(request: Request) {
  // Dev-only: this handler hits a paid upstream with no auth or rate limit, so
  // it must not be reachable in production — use /api/search (rate-limited).
  if (process.env.NODE_ENV === 'production') {
    return Response.json({ ok: false, error: 'Not found' }, { status: 404 })
  }
  const q = new URL(request.url).searchParams
  const adults = parseInt(q.get('adults') ?? '', 10)
  const { depart, return: ret } = clampTravelDates(
    q.get('depart') ?? undefined,
    q.get('return') ?? undefined,
  )
  const params: SearchParams = {
    from: (q.get('from') ?? 'SFO').trim().toUpperCase(),
    to: (q.get('to') ?? 'LAX').trim().toUpperCase(),
    depart,
    return: ret,
    adults: Number.isFinite(adults) && adults > 0 ? adults : 1,
  }
  const result = await searchAwards(params)
  return Response.json(result)
}
