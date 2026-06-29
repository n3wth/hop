// GET /api/dream/card?index=N — the ENGINE pick for a given portfolio corner,
// serialized as DreamCardData (destination, miles, cpp, cash, the pool→program
// proof, photo, seeded search href, templated blurb). Powers "Dream me another":
// the client swaps the visible card to this, then streams fresh narration from
// /api/dream. All numbers are the engine's. Never throws; always 200 JSON.

import { NextResponse } from 'next/server'
import { ledgerDream } from '@/lib/ledger-dream'
import { resolveDreamSession } from '@/lib/dream-server'
import { toDreamCardData } from '@/lib/dream-view'
import { destinationImage } from '@/lib/images'
import { templatedBlurb } from '@/lib/dream-narration'

export const runtime = 'nodejs'

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const raw = Number(url.searchParams.get('index'))
  const index = Number.isFinite(raw) ? Math.max(0, Math.floor(raw)) : 0

  try {
    const { balances, origin } = await resolveDreamSession()
    const dream = ledgerDream(balances, index)
    // Hero photo (cached per query). Null → the card renders the brand fallback.
    const photo = await destinationImage(dream.imageQuery).catch(() => null)
    const card = toDreamCardData(dream, photo, templatedBlurb(dream), origin)
    return NextResponse.json(card)
  } catch (err) {
    console.error('[dream/card] failed', err)
    // Last-resort: a save-toward dream with no photo, so the client still updates.
    const dream = ledgerDream([], index)
    return NextResponse.json(toDreamCardData(dream, null, templatedBlurb(dream)))
  }
}
