# 0014. First-party award quotes; seats.aero off the commercial path

Status: Accepted
Date: 2026-08-21

## Context

hop's verdict engine (`lib/search.ts#assembleSearch`) needs award **miles + taxes + cabin +
program** so `lib/cpp.ts` can compute cents-per-point against Duffel cash. That award firehose
was `lib/seatsaero.ts` (Partner API) until #415 (2026-08-22) replaced search with
`lib/awards.ts` → published charts. seats.aero's published terms prohibit commercial
API use without written permission. The commercial license is, as of 2026-08-21, unaffordable.
The 2026-07-06 inquiry (`docs/finance/outreach.md` Item 1) is **closed as won't-buy**.

July 4 §3.1 gate ④ was "written commercial terms" before flipping billing. The 2026-08-20
addendum already said a failover stub that keeps seats.aero primary does **not** pass that
gate. `HOP_ENABLE_BILLING` is reported ON anyway. N-386 (fallback prototype) is still zero
code. Default `/search` is SFO-LAX; a charts PR that only tests SFO-NRT can pass the
license ticket while the live front door goes cash-only.

Cloning seats.aero (calendars, 30+ programs, historical, everywhere-search) is a different
company. hop's actual call is one cached `GET /partnerapi/search` per origin/dest/date.

Credential-sync already established the Browser Rendering pattern and the honesty rule:
unverified programs return `unsupported`, no anti-bot evasion (`docs/plans/2026-07-05-credential-sync.md`).

## Decision

**We will not license seats.aero for hop's paid product.** Gate ④ is restated: **no
production hop process** calls the Partner API **and** the Production key is unset.
Chart quality is not the gate. Flag-off with the key left in Vercel is not equivalent.
**④ ≠ keep billing ON.**

**We will not clone seats.aero.** We replace the narrow search:

1. **Chart-cpp (default, unblocks the license).** One committed snapshot
   (`lib/award-charts.ts`) of published saver tables + typical taxes, transcribed from
   the **program's own public page**. Rows carry `availability: 'chart'`. Copy cannot
   be read as a held seat **or** as today's MileagePlus-style quote (saver floors are
   labeled floors). Miles/taxes are table facts; cpp is still `lib/cpp.ts`. Chart rows
   must not feed `recordCppObservations` (ADR 0005). `evaluateOrder` does not cross on
   chart. v1 covers default `/search` SFO-LAX (Alaska NA own-metal floor) and SFO-NRT
   (Aeroplan Pacific). No live worker, no `lib/award-live.ts` in that PR.
2. **First-party live search (quality, later).** Cloudflare Queue + Durable Object +
   Browser Rendering worker. Recipes start empty; four then five US-core programs
   (UA, AS, AC, AA, DL last). **Search path never waits on a browser** — live space is
   an Upstash cache filled in the background; chart-cpp answers on a miss. Calendar
   JSON from the **program's own** search UI or documented airline endpoint — not a
   third-party award API, not DOM scrape, not `/json` AI extract. Not credential-sync:
   no vault, no hop-owned airline logins, no shared member session until a
   founder-owned ADR. Live rows carry `availability: 'live'` only on cache hit.

**We will not** scrape seats.aero, scrape another award tool, rent AwardSecrets/PointsYeah as
a substitute landlord (including "just the seat bit" on chart-cpp), or let an LLM invent
miles or taxes (ADR 0002).

`assembleSearch` remains the only verdict funnel. A new `lib/awards.ts` facade is the only
import site. `MOCK=1` fixtures stay.

## Consequences

- Gate ④ (license) can pass on chart-cpp once the Partner API is not called and the
  Production key is unset. Live availability is no longer a license prerequisite. It is
  a product gap until Stage B. Billing stays **off** until honest-Pro copy (④b) also
  ships — alerts and MCP must not claim space on a chart.
- The July 4 one-liner ("every award tool can tell you a seat exists") is false for hop until
  Stage B. Marketing and verdict CTAs must carry the chart caveat.
- Dynamic programs without a published saver table (AA, DL, United domestic) are omitted in
  Stage A rather than guessed — coverage will look thinner than seats.aero. That is the
  trade for not paying the landlord.
- Airline ToS may block Stage B recipes. Blocked programs stay chart or absent; we do not
  add evasion, and we do not turn seats.aero back on to paper over it.
- `assembleSearch` must not await Browser Rendering. Live availability is eventually
  consistent (Queue + cache). Putting Playwright on Vercel is out of spec.
- OSS award-search repos are almost all seats.aero wrappers; seataero is the exception
  (United calendar JSON + SQLite) and is a pattern source, not a dependency.
- Founder still must take seats.aero off Vercel Production and, until then, treat billing-ON
  as a legitimacy miss.

Implementation: `docs/plans/2026-08-21-replace-seatsaero.md`.
