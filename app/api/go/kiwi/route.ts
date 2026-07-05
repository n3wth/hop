// GET /api/go/kiwi?to=<encoded affiliate url>&route=AAA-BBB — first-party cash
// outclick redirect (Linear N-302, R0.6 "make cash revenue reconcilable").
// lib/booking.ts#cashBookingUrl mints hrefs pointing here (cashOutclickPath);
// we log one hop_outclicks row (kind 'cash') and 302 to the affiliate
// destination, so Travelpayouts commission reports can be reconciled against a
// first-party click ledger.
//
// - The ?to= target is user-controllable input, so it passes the STRICT
//   allowlist in lib/booking.ts#isAllowedCashOutclickUrl before it can reach
//   the Location header: https-only, no credentials/port, and either a bare
//   kiwi.com deep-link OR a tp.media/r wrapper whose ?u= is itself a kiwi.com
//   deep-link. tp.media is an open redirector, so the allowlist validates that
//   inner ?u= target too — never just the outer host, or this would be an open
//   redirect. Anything else 302s to '/' (a tampered or stale link lands
//   somewhere, never a 500).
// - ?route= is ledger context only (normalized to AAA-BBB or stored as
//   'unknown'), never a redirect input.
// - 302 (temporary), deliberately NOT 308: the destination is minted by
//   lib/booking.ts and has already changed form once (plain kiwi.com deep-link
//   → tp.media attribution link) — a cached permanent redirect would pin
//   browsers to a stale form.
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
