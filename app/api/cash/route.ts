// GET /api/cash — thin debugging handler for the Duffel cash client.

import type { SearchParams } from '@/lib/types'
import { searchCash } from '@/lib/duffel'
import { clampTravelDates } from '@/lib/travel-dates'

export async function GET(request: Request) {
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
  const result = await searchCash(params)
  return Response.json(result)
}
