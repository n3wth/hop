// GET /api/awards — thin debugging handler for the Seats.aero award client.

import type { SearchParams } from '@/lib/types'
import { searchAwards } from '@/lib/seatsaero'

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams
  const adults = parseInt(q.get('adults') ?? '', 10)
  const params: SearchParams = {
    from: (q.get('from') ?? 'SFO').trim().toUpperCase(),
    to: (q.get('to') ?? 'LAX').trim().toUpperCase(),
    depart: q.get('depart') ?? '2026-07-09',
    return: q.get('return') ?? '2026-07-12',
    adults: Number.isFinite(adults) && adults > 0 ? adults : 1,
  }
  const result = await searchAwards(params)
  return Response.json(result)
}
