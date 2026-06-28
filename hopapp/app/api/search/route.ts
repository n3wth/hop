// GET /api/search — parse SearchParams from the query string, assemble the
// full SearchResult, and return it as JSON. Always responds 200; the assembler
// never throws and degrades gracefully on upstream failure.

import type { SearchParams } from '@/lib/types'
import { assembleSearch } from '@/lib/search'

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
  const result = await assembleSearch(params)
  return Response.json(result)
}
