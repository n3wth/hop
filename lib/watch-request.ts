// Bridges a live SearchResult.params to the shape createWatchExplicit expects
// (app/actions/standing-orders.ts). PURE — no network, no defaults invented:
// every field is copied straight off params, so "watch this route" always
// watches the EXACT route/date/cabin the verdict on screen was computed for,
// never a paraphrase of it. minCpp is intentionally omitted — the server
// clamps a missing value to MIN_CPP_FLOOR (lib/standing-orders-model.ts),
// which equals lib/search.POINTS_THRESHOLD_CPP, so the watch fires exactly
// when this route crosses the same line the verdict already draws.

import type { SearchParams } from '@/lib/types'

export interface WatchRequest {
  from: string
  to: string
  depart: string
  ret?: string
  adults: number
  children?: number
  infants?: number
  minCabin?: string
}

export function watchRequestFromParams(params: SearchParams): WatchRequest {
  return {
    from: params.from,
    to: params.to,
    depart: params.depart,
    ret: params.return,
    adults: params.adults,
    ...(params.children !== undefined ? { children: params.children } : {}),
    ...(params.infants !== undefined ? { infants: params.infants } : {}),
    minCabin: params.cabin,
  }
}
