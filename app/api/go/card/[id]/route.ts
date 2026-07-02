// GET /api/go/card/[id] — first-party affiliate outclick redirect (roadmap
// WS2, monetization Phase 1.5). CardAffiliateCTA's href points here (built by
// lib/card-affiliates.ts#cardOutclickPath); we log one hop_outclicks row and
// 302 to the card's applyUrl.
//
// - 302 (temporary), deliberately NOT 308: the destinations swap from today's
//   placeholder landing pages to CJ/Impact network deep links when the
//   partnership lands — a cached permanent redirect would pin browsers to the
//   placeholders.
// - Redirect targets come ONLY from the static lib/card-affiliates.ts table.
//   The ?program= query is stored as verdict context, never followed — no
//   open redirect (docs/plans/2026-07-02-monetization-phase-1.md §4).
// - The ledger is best-effort, the redirect is first-class: recordOutclick is
//   fire-and-forget (withDb degrades silently while drizzle/0006_outclicks.sql
//   is unapplied) and is never awaited.
// - Unknown id → 302 to '/' (a stale link lands somewhere, never a 500).
// - Caching: GET route handlers are dynamic by default in Next 16 (static
//   GET caching was dropped in v15), and reading `request` keeps this
//   per-request — no segment config needed.

import { cardById } from '@/lib/card-affiliates'
import { recordOutclick } from '@/lib/outclicks'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const url = new URL(request.url)

  const card = cardById(id)
  if (!card) return Response.redirect(new URL('/', url), 302)

  recordOutclick({
    kind: 'card',
    target: card.id,
    url: card.applyUrl,
    program: url.searchParams.get('program'),
    userAgent: request.headers.get('user-agent'),
  })

  return Response.redirect(card.applyUrl, 302)
}
