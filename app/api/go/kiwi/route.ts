// GET /api/go/kiwi?to=<encoded affiliate url>&route=AAA-BBB — first-party cash
// outclick redirect (Linear N-302, R0.6 "make cash revenue reconcilable").
// lib/booking.ts#cashBookingUrl mints hrefs pointing here (cashOutclickPath);
// we log one hop_outclicks row (kind 'cash') and 302 to the affiliate
// destination, so Travelpayouts commission reports can be reconciled against a
// first-party click ledger.
//
// - The ?to= target is user-controllable input, so it passes the STRICT
//   allowlist in lib/booking.ts#isAllowedCashOutclickUrl (https-only, exact
//   kiwi.com/tp.media hostnames, no credentials/port) before it can reach the
//   Location header — never an open redirect. Anything else 302s to '/'
//   (a tampered or stale link lands somewhere, never a 500).
// - ?route= is ledger context only (normalized to AAA-BBB or stored as
//   'unknown'), never a redirect input.
// - 302 (temporary), deliberately NOT 308: the destination swaps from the
//   plain kiwi.com deep-link to a tp.media attribution link when that lands —
//   a cached permanent redirect would pin browsers to the old form.
// - The ledger is best-effort, the redirect is first-class: the write is
//   scheduled with next/server's after() — executed once the 302 is sent, so
//   the response never waits on the DB, and the serverless runtime doesn't
//   cut the insert off mid-flight. withDb still degrades silently when the DB
//   is unconfigured or down.
// - Caching: GET route handlers are dynamic by default in Next 16, and
//   reading `request` keeps this per-request — no segment config needed.

import { after } from 'next/server'

import { isAllowedCashOutclickUrl, normalizeOutclickRoute } from '@/lib/booking'
import { recordOutclick } from '@/lib/outclicks'

export async function GET(request: Request) {
  const url = new URL(request.url)

  const to = url.searchParams.get('to') ?? ''
  if (!isAllowedCashOutclickUrl(to)) return Response.redirect(new URL('/', url), 302)

  const route = normalizeOutclickRoute(url.searchParams.get('route')) ?? 'unknown'

  after(() =>
    recordOutclick({
      kind: 'cash',
      target: route,
      url: to,
      userAgent: request.headers.get('user-agent'),
    }),
  )

  return Response.redirect(to, 302)
}
