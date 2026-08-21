# 2026-08-21 — Replace seats.aero (first-party award quotes)

> Plan. Status: **adopted operating decision** (this PR), implementation not started.
> Founder (2026-08-21): do not buy seats.aero commercial terms; the license is unaffordable.
> Build the narrow thing hop actually uses the Partner API for, then take seats.aero off the
> paid path. Does not replace the 2026-07-04 business plan or the 2026-08-20 first-dollar
> addendum — it *amends gate ④ and FD-fallback* in both. ADR: `0014`.

**How this doc relates to the others.** `docs/plans/2026-08-20-path-to-first-dollar.md`
still sequences the 90 days (distribution, MCP, B2B). This file is the award-data blueprint
those 90 days now run on. July 4 still owns price (`$49/yr`) and the other three billing
gates. Linear N-320 (written terms) is **won't-buy**. Linear N-386 (failover prototype) is
**re-specified as replacement**, not silent failover.

---

## 1. What hop actually uses seats.aero for

Not a calendar. Not a map. Not "everywhere" search. One function:

`lib/seatsaero.ts#searchAwards` → `GET https://seats.aero/partnerapi/search` with
`origin_airport`, `destination_airport`, `start_date`, `end_date`, `take=50`. Timeout 10s.
Redis cache 300s. Never throws.

Per record hop keeps, then `pickCabin` → `FlightOption`:

| Field | Seats.aero | What `assembleSearch` needs |
|---|---|---|
| Program | `Source` slug (`united`, `alaska`, `aeroplan`, …) | `program` + `airline` / `airlineCode` |
| Date | `Date` | display date |
| Cabin + space | `Y/W/JAvailable` | served cabin label; a row only if a cabin can be priced |
| Miles | `*MileageCost` | per-direction, per-seat |
| Taxes | `*TotalTaxes` (cents) | per-direction, per-seat, dollars |
| Metal | `*Airlines` | operating carrier for the monogram |
| Book | hop's own `pointsBookingUrl` | not seats.aero's URL |

`lib/search.ts#assembleSearch` fans Duffel cash + this + balances in `Promise.all`. Award
miles/taxes stay **per direction per seat**; the engine scales by `seatsFor` × legs, then
`lib/cpp.ts` does `cpp = (cash − taxes) × 100 / miles`. That formula does not change.

That is the whole dependency. Cloning seats.aero (30+ programs, heatmaps, historical,
"anywhere") is a multi-year company. hop needs **miles + taxes + cabin + program**, and
— only later — **whether saver space is actually open**.

`MOCK=1` fixtures in `lib/mock.ts#mockAwards` already mirror the per-direction shape. There
is no second award client under `lib/` today.

---

## 2. Decision (load-bearing)

**We will not license seats.aero for a paid product.** Inquiry sent 2026-07-06
(`docs/finance/outreach.md` Item 1) is closed as **won't-buy**, not "still waiting."

**A failover client that keeps seats.aero as primary does not pass gate ④.** That was
already true on 2026-08-20; this decision makes the other fork real. Replacement means
production commercial search does not call seats.aero. The key is removed from Vercel
Production (or `HOP_ENABLE_SEATSAERO` is off — same effect). Local `MOCK=1` is unaffected.

**Chart-cpp is enough for billing legitimacy. Live first-party search is product quality.**
Paid Pro on a still-primary seats.aero feed remains a plan violation even though the
license is "too expensive."

**Do not scrape seats.aero** (site or Partner API without paying). Do not scrape another
award tool's UI. Do not rent AwardSecrets / PointsYeah / ExpertFlyer as "building it" —
those are a different landlord.

ADR 0014 records the build-vs-buy choice.

---

## 3.1 OSS we actually looked at (2026-08-21)

There is **no open-source seats.aero**. Almost every GitHub "award search" repo is a
thin MCP/CLI over the same Partner API hop already calls. Vendoring them does not
remove the license.

| Project | What it actually is | Takeaway for hop |
|---|---|---|
| `baeleb/seats-MCP`, `gavgrego/seats.aero-mcp-server`, `cjmcenery/seats-aero-mcp` | Partner API wrappers. Pro key required. `/live` needs commercial terms | Same landlord |
| `wrahim3933/pointpilot-core` | OSS hop-shaped engine (cpp + Duffel + playbooks) | Still `SEATS_AERO_API_KEY`. Same trap |
| `nstevens/flight-finder` | Cash (Google Flights) + awards (seats.aero) + AeroLOPA | Same |
| `andrew-demers/flights-points-tool` | seats.aero first; "airline site" fallback | **Honest negative:** AA.com / United.com / Delta.com Cloudflare + behavioral analysis beat Playwright stealth. Their fallback scrapes *seats.aero's site*, which we will not do |
| `JadedOut/seatsaero` (`seataero` on PyPI) | Personal United tool: Playwright login + **award-calendar JSON** (~30 days/request) + SQLite + MCP. SMS MFA. `python-ghost-cursor`. 10 min between scrapes or Akamai starves you | **Architecture to copy, code not to vendor.** Python, personal MP login, evasion helpers, one airline, no partner awards |
| Award Travel Finder (plugin OSS, backend closed) | Cloudflare Workers, "airline APIs", **4-hour cache**, plus `get_program_rates` chart tools | Confirms Stage A (charts) is a real product surface and Stage B must be **cached**, not live-on-request |
| `markswendsen-code/mcp-united` | Playwright booking/check-in | Wrong product; MFA session |
| `shilph/art` | Playwright **balance** scrapers | hop already has credential-sync |

**What to steal (ideas, not code):**

1. **Calendar JSON after a session, not DOM parse.** seataero's 30-day United calendar
   call is why seats.aero itself is fast. Recipes target those XHR/JSON endpoints.
2. **Warm session + local cache.** Search is a SQLite/KV read. Scrape is a background
   job (~2 min, MFA once per session).
3. **Charts as a first-class API.** Award Travel Finder's `get_program_rates` is Stage A.

**What not to steal:** stealth flags, ghost-cursor, scraping seats.aero HTML, putting a
2-minute United scrape on the Next.js request path, using a user's MileagePlus login to
power everyone else's search (ToS + blast radius). Hop-owned research accounts, if any,
are founder-gated and one ban ≠ product outage (chart fill).

---

## 3. Two stages (do not collapse them)

### Stage A — chart-cpp (`FD-charts`) — unblocks legitimacy

Published saver mileage tables + typical taxes, `availability: 'chart'`, copy that cannot
be mistaken for a held seat.

- Legal: transcribe published program facts (same class as `lib/sweet-spots.ts` seed
  figures). No Partner API. No scraping a competitor.
- Cheap: $0 after the snapshot. Fits the ~$125/mo envelope.
- Honest: hop answers "if saver space is open, is this a good burn of *your* miles?"
  It does **not** answer "a seat exists."
- Engine: same `FlightOption` → `assembleSearch` → `lib/cpp.ts`. Miles and taxes come
  from committed tables, never from an LLM.

This is a **positioning change** until Stage B. July 4's one-liner is *"Every award tool
can tell you a seat exists. hop tells you whether to burn your points on it."* Chart-cpp
drops the first clause. The remaining edge is still real: balances × computed cpp. Show HN
/ r/awardtravel drafts must say the chart caveat before they ship (A-hn rewrite, already
gated on A-terms).

### Stage B — first-party live search (`FD-live`) — restores "a seat exists"

Live award search for **four US-core programs**, then a fifth. Not request-path
Puppeteer: **cache-first** on Upstash, Cloudflare Queue + Durable Object + Browser
Rendering to fill a calendar JSON store in the background (§6). Balance-fetch is the
login primitive; seataero is the calendar-cache pattern. Do not mirror
`balance-fetch-worker` as a synchronous `POST /search`.

| Order | Program | Why first |
|---|---|---|
| 1 | United MileagePlus | seataero proved a ~30-day calendar JSON exists; first recipe |
| 2 | Alaska Atmos | Charted partners; hop's mock pick |
| 3 | Aeroplan | Distance chart + public search |
| 4 | American AAdvantage | US-core; mostly dynamic — recipe may return "unsupported" honestly |
| 5 | Delta SkyMiles | Last. Dynamic. Do not fake a chart for it in Stage A either |

Programs without a verified recipe stay on chart-cpp (or absent), labeled chart, never
dressed as live.

**ToS / account-ban risk is the same honesty as credential-sync.** Major programs fight
automation. Recipes start empty; unverified programs return `{ok:false, reason:'unsupported'}`.
No anti-bot evasion, no residential proxies, no CAPTCHA farms. A blocked fetch is a chart
fill — not a silent invention, and not `degraded[] 'awards'` on an otherwise-working
chart path.

Stage B does **not** use the user's credential vault to search for everyone. If a
calendar needs a login, that is a **hop-owned research account** (founder-gated wrangler
secret), one ban ≠ product outage. User-credential composition is a later ticket and is
not Stage B's done-means.

### Rejected / parked (named so they don't come back)

| Idea | Why not |
|---|---|
| Clone seats.aero | Wrong product. hop is the cpp layer, not the availability layer |
| AwardSecrets pay-per-search (~$0.02/search) | Another landlord; sample payload is carrier/cabin/seats, **no mileage cost**, so cpp still needs a chart. At 10–14 visitors/week the dollar cost is small; the dependency is not |
| PointsYeah / AwardLogic / ExpertFlyer commercial API | Same class of bill as seats.aero; partnership-gated |
| Scrape seats.aero or another tool | ToS + the thing we just refused to pay for |
| LLM-estimated miles or taxes | Breaks ADR 0002 |
| Chart rows feeding `recordCppObservations` | Would poison ADR 0005 live valuations with unpublished-space math |
| Dynamic programs (AA/DL) as fake chart rows | Absent is honest; a made-up saver band is not |
| Vendoring seats.aero MCP wrappers | They still need the license we refused |
| Request-path Playwright on Vercel | Live scrape is 30s–2 min; `assembleSearch` must stay fast. Airline sites beat stealth flags (see §3.1) |
| Cloudflare `/json` / Stagehand / Firecrawl for miles | AI extraction of economic figures — ADR 0002. Unused `FIRECRAWL` seam stays unused |
| `python-ghost-cursor` / stealth / residential proxies | Credential-sync already forbade evasion. seataero needs it because United's Akamai does; we do not add it |

---

## 4. Engine hooks (constraints on every PR in this plan)

`assembleSearch` stays the funnel. New code is a client behind it, never a parallel
verdict path.

```
assembleSearch
  ├ searchCash          lib/duffel.ts          unchanged
  ├ searchAwards        lib/awards.ts          NEW facade (only import site)
  │    ├ chart          lib/award-charts.ts    Stage A
  │    ├ live           lib/award-live.ts      Stage B, flag-gated
  │    └ seatsaero      lib/seatsaero.ts       prod OFF; delete key; keep file until Stage B is primary
  └ balances            lib/accounts.ts        unchanged
         │
         ▼
  seats × legs scale, lib/cpp.ts, prefs, pick, verdict
  recordCppObservations  SKIP any option with availability === 'chart'
  degraded[] 'awards'    only when the configured source returns {ok:false}
```

- **Facade.** `lib/search.ts` imports `searchAwards` from `lib/awards.ts`, not from
  `lib/seatsaero.ts`. Call sites (tests, sweet-spot-candidates) follow.
- **Flag.** `lib/env.ts`: `HOP_ENABLE_SEATSAERO` (double-lock with `SEATS_AERO_API_KEY`)
  and `HOP_ENABLE_LIVE_AWARDS` (double-lock with worker URL + secret). Chart-cpp is the
  **default live path** once Stage A ships — not a flag you forget to turn on. Seats.aero
  in production is opt-in and must stay off.
- **`FlightOption`.** Add `availability?: 'live' | 'chart'`. Absent on cash. Chart rows
  set `'chart'`. Live rows set `'live'`. UI and telemetry branch on this field, not on
  id prefixes.
- **Copy.** Chart row `note` (or equivalent) states the caveat. Suggested voice
  (`docs/design/copy-spec.md`): `Chart price if saver space is open. hop isn't holding a
  seat.` `fareBrand` may be `Chart`. Never "available", "found N seats", or a green
  availability chip on a chart row. `DegradedNote` stays for source *failure*; chart-cpp
  succeeding is not a degradation.
- **Taxes.** US domestic: published award-tax band as a dated snapshot (the ~$5.60–$11.20
  OW class). International: typical-by-region table, **conservative (higher)** so cpp is
  not optimistic. Source + as-of date on the file header, climate-normals style. Missing
  tax → do not emit the row (miles-only cpp overstates value).
- **Miles.** Per program, per cabin, from a published chart or distance band. Dynamic
  programs with no published saver table are **omitted** in Stage A, not guessed.
- **Distance.** Committed hub-coords snapshot (`lib/airport-coords.ts`, ~200 IATA hubs
  hop actually sees), public lat/lon as facts, header names the source. Great-circle for
  distance-banded programs (Aeroplan, Avios). Unknown airport → `{ok:true, data:[]}` for
  that program, not a throw and not a fabricated band.
- **Never throws.** `{ok:false}` / empty list. `degraded[]` `'awards'` only when the
  configured source fails closed (live worker down *and* chart also empty is a product
  question: prefer chart fill over a blank awards column).
- **Empty is not degraded.** Chart-cpp that finds no published band for this route returns
  `{ok:true, data:[]}`. That is not `degraded[] 'awards'` and not "Award data is unavailable."
  Search UI copy for that case: `No published saver chart for this route.` Cash still
  renders. Do not dress a coverage hole as an outage.
- **CTAs.** Chart rows must not use the live-space primary `Book with X miles`. Primary:
  `Check X for space` (existing `pointsBookingUrl` already goes to the program). The caveat
  stays on the row. A naked book CTA on `availability: 'chart'` is a defect.
- **Free/paid.** Chart-cpp is the same verdict on free and Pro. Pro stays alerts + MCP
  quota (July 4 §3.1). Do not sell live space as the paid line.
- **Telemetry.** `lib/valuation-telemetry.ts` must not POST chart rows. Tests lock this.
- **MOCK=1.** Unchanged fixtures. Chart-cpp is the *non-mock* production path.

---

## 5. Stage A — what to build (`FD-charts`)

Pickup after **FD-copy** (the "live bookings" string). One PR if it stays small; split
tables vs. wiring if the snapshot is large.

| Piece | Path | Notes |
|---|---|---|
| Facade | `lib/awards.ts` | `searchAwards(params)` routes by flags; `{ok:false}` never throws |
| Charts | `lib/award-charts.ts` | Published saver tables / distance bands. Header: program, source URL, as-of date. No LLM |
| Taxes | `lib/award-taxes.ts` | Region × cabin typical taxes (dollars). Conservative. Header: source + as-of |
| Coords | `lib/airport-coords.ts` | ~200 hubs. Facts, committed. Used only for distance-banded charts |
| Env | `lib/env.ts`, `.env.example` | `HOP_ENABLE_SEATSAERO` double-lock; chart is default when that is off |
| Types | `lib/types.ts` | `availability?: 'live' \| 'chart'` |
| Assembler | `lib/search.ts` | Import facade; skip chart rows in `recordCppObservations` |
| Copy | search UI / option note | Chart caveat. Copy-voice review |
| Tests | `lib/__tests__/award-charts.test.ts` (new) + assembler | See §7 |
| Callers | `lib/sweet-spot-candidates.ts` etc. | Must tolerate no `SEATS_AERO_API_KEY`; chart or skip |
| Ops | `docs/ops-runbook.md` | How to keep seats.aero **off** in Production |

**Coverage for v1 (do not expand in the same PR):** Aeroplan (distance), Alaska partner
bands, Virgin Atlantic partner bands, Avios distance, United **partner** published bands
where they still exist. Skip United domestic-dynamic, AA, DL.

**US domestic hole, named:** hop's locked mock is SFO→LAX Alaska 4,500 mi. That story is
`MOCK=1` fixtures (`lib/mock.ts`), **not** a promise that production chart-cpp will emit
the same row. United domestic saver is dynamic — omitted in Stage A. A live `MOCK=0`
SFO→LAX search may return **cash only** plus `No published saver chart for this route.`
Do not stretch an Alaska "starting at" band to look like live domestic space. Screenshot
and Show HN demos stay on `MOCK=1` until Stage B has a verified Alaska or United recipe.
A transpacific/transatlantic charted example (SFO→NRT / JFK→LHR class) is the honest
`MOCK=0` demo for Stage A.

**Done means:**

1. Production commercial search does not call seats.aero (`HOP_ENABLE_SEATSAERO` off or
   key absent; a test asserts the client is not invoked when the flag is off).
2. A SFO→NRT (or similar charted) search in `MOCK=0` returns award rows with
   `availability: 'chart'`, miles/taxes from the tables, cpp from `lib/cpp.ts`.
3. Copy on those rows cannot be read as live space.
4. Chart rows do not appear in valuation-observation payloads.
5. Dynamic-only programs emit nothing, not a guessed saver.
6. Founder (or ops) removes `SEATS_AERO_API_KEY` from Vercel Production, or leaves it
   present but flag-off (byte-for-byte no-op). Record that in the ops-runbook current-state
   table. **Gate ④ passes when (1) and (6) are true.** Chart quality is not the gate.
7. `app/terms` / `app/privacy` stop listing seats.aero as a live commercial upstream once
   the key is gone. Same PR or the immediate follow-up — do not advertise a feed we
   refused to pay for.

**Founder action still attached:** until (1)+(6) are true, `HOP_ENABLE_BILLING` ON is
still a legitimacy miss. Flip the billing flag **off** now, or ship FD-charts next and
then leave billing on. "Won't buy, still on the unlicensed feed" is the 2026-08-20
violation with extra steps.

---

## 6. Stage B — reliable live search (`FD-live`)

Do not start until Stage A is in production and gate ④ has passed. This is quality, not
the license ticket.

**Reliability rule:** `assembleSearch` never waits on a browser. Live space is an
eventually-consistent cache. Chart-cpp is the synchronous answer on a miss.

OSS and Cloudflare's own Browser Rendering docs agree: launch-per-request dies to cold
start, concurrency caps (~10 browsers/account), and airline Akamai. seataero is slow
because it scrapes on demand; it is *usable* because SQLite makes the next query instant.

### 6.1 Split: Vercel answers, Cloudflare fetches

Hop already runs this split for valuations (ADR 0005 / ADR 0011) and balance-fetch.
Do not put Playwright on Vercel Fluid/serverless. Vercel has no first-party browser
product; Cloudflare Browser Rendering (now "Browser Run") is the one we already enable
for `cloudflare/balance-fetch-worker/`.

```
Vercel  assembleSearch  (sync, today's 10s budget)
  │
  ├ cacheGet Upstash `hop:awards:live:{program}:{from}:{to}:{date}`
  │    hit  → FlightOption availability:'live'
  │    miss → chart-cpp (sync) + enqueue Cloudflare Queue (do not await)
  │
  └ standing-orders cron (already every 6h in vercel.json)
       → enqueue watched routes so alerts see live space without a user search

Cloudflare  cloudflare/award-search-worker/
  Queue consumer (buffer; stay under Browser Rendering concurrency)
       → Durable Object per program (one warm browser/session)
            login once (SMS MFA is founder/ops, not per-user)
            then GET the program's award-calendar JSON (not a DOM scrape)
            write ~30 days → D1 (or KV)
            also SET the Upstash keys hop reads (REST; same cache.ts contract)
  Workers Cron: keep-alive ping so the DO session does not idle-out;
                optional prefetch of a small hub-pair allowlist
```

| Piece | Platform | Why this one |
|---|---|---|
| Sync search + chart-cpp | Vercel Next.js | `assembleSearch` already lives here; 10s budget |
| Hot cache | **Upstash Redis** (existing `lib/cache.ts`) | Same seam as seats.aero's 300s cache; in-memory fallback; no new vendor |
| Refresh enqueue | **Cloudflare Queues** | Official pairing with Browser Rendering; absorbs bursts; `max_concurrency` caps browsers |
| Warm session | **Durable Object + Browser Rendering** (Playwright or Puppeteer) | Cloudflare's documented reliability pattern: reuse the browser, don't launch per search. One DO per program so cookies stay on the right origin |
| Calendar store | **D1** (already on the valuations worker) | 30-day windows, queryable, cheap. KV is fine for blobs; D1 fits "all dates SFO-NRT" |
| Keep-alive / prefetch | **Workers Cron** | DO idle timeout; do not burn a Vercel cron on browser keep-alive |
| Watched-route refresh | **Existing Vercel cron** `/api/cron/standing-orders` | Alerts already promise "hop pings you"; they should enqueue live refresh, not scrape inline |

**Recipe shape (not HTML selectors for miles):** after the session is warm, call the
same XHR the airline calendar uses. Parse JSON with a typed schema; clamp; drop the
row if miles/taxes missing. Visible-text fallback (balance-fetch style) is a last
resort and still must yield numbers that parse as integers, never an LLM guess.

**Do not use for Stage B:** Cloudflare `/crawl` (site-wide, robots.txt, verified bot —
airline calendars will 403), `/json` Quick Action (Workers AI structured extract),
Stagehand, Firecrawl. Those are content pipelines, not fare engines.

### 6.2 Files

| Piece | Path | Notes |
|---|---|---|
| Worker | `cloudflare/award-search-worker/` | Queue + DO + Browser binding + D1. `RECIPES` starts empty. Bearer secret. No user credentials. Hop-owned research logins, if any, are wrangler secrets and founder-gated |
| Client | `lib/award-live.ts` | Cache read only on the request path. Enqueue on miss. `{ok:true, data, pending?: true}` — pending is chart fill, not `degraded[] 'awards'` |
| Merge | `lib/awards.ts` | Live cache hit → `availability:'live'`; else chart |
| Flag | `HOP_ENABLE_LIVE_AWARDS` + worker URL + secret | Double-lock. Off = chart-only |
| Cron hook | standing-orders path | Enqueue `{program, from, to, date}` for active watches. No new cron unless prefetch needs one |
| Tests | mocked queue/cache | Never hit a real airline in CI |

### 6.3 Done means (per program, independently)

1. A verified recipe returns miles, taxes, cabin, and a live availability bit from the
   program's **calendar JSON** (or a documented public endpoint). DOM-only recipes are
   not done.
2. `availability: 'live'` only on cache hits. Chart fill stays `chart`. A cache miss
   does not block the search and does not mark awards degraded.
3. Bot-block / layout-shift / Akamai starve → `{ok:false, reason:'unsupported'|…}`,
   chart fill, no invented miles. Rate: seataero's floor is **≥10 min between scrapes**
   of United; hop's queue consumer must not run hotter than that per program.
4. Cache hit does not launch a browser (assert in tests).
5. One Durable Object per program; browsers reused; Worker excluded from the Next
   app's typecheck/lint/build.
6. Standing-order refresh uses the queue, not a synchronous worker fetch inside the
   Vercel cron (cron timeout + browser = flakes).

**Cost at current traffic.** 10–14 hop.flights visitors/week. Browser-minutes are
dominated by **keep-alive**, not searches, if we keep a warm DO. Prefer: keep-alive
only while there is a queue backlog or an active watch; otherwise let the session die
and pay a cold start on the next enqueue. Do not run 5 always-on browsers for 14
visitors. If volume jumps after A-hn, raise cache TTL before raising concurrency
(Award Travel Finder uses 4h; hop can start at 60 min).

**First program:** United, because seataero already proved the calendar-JSON shape
exists — hop still has to reverse-engineer our own recipe (do not copy their evasion
or their client). Alaska / Aeroplan next if their calendars expose JSON; AA/DL last
and may stay `unsupported` forever (flights-points-tool's finding).

---

---

## 7. Tests (lock these; do not "cover the file")

Stage A:

- Chart lookup for a known band (e.g. Aeroplan distance) returns the table miles, not a
  computed guess beyond the band function.
- Unknown IATA → no row for distance-banded programs (empty, not a throw).
- Missing tax band → no row.
- `cpp(cash, chartTaxes, chartMiles)` matches `lib/cpp.ts` (assembler test, not a second
  formula).
- `HOP_ENABLE_SEATSAERO` off → `lib/seatsaero.ts` not called (mock/spy).
- `recordCppObservations` omitted for `availability: 'chart'`.
- AA/DL (no Stage A table) → absent from awards.
- Empty chart (no band) → `{ok:true, data:[]}`; assembler does **not** push `'awards'` to
  `degraded[]`.
- Copy fixture: chart `note` contains the caveat string; does not contain "available" as
  a seat claim. Chart pick CTA is not `Book with`.

Stage B (when that PR lands):

- Unsupported recipe → chart fill, `availability: 'chart'`.
- Live **cache hit** → `availability: 'live'`, miles from cached payload, cpp still
  `lib/cpp.ts`.
- Live **cache miss** → chart fill, enqueue called, `'awards'` **not** in `degraded[]`.
- Queue/worker 5xx → chart fill, not empty-and-degraded if chart has rows.
- Both live-cache empty and chart empty → `degraded[]` includes `'awards'` only if the
  chart source itself `{ok:false}`. Empty chart is still `{ok:true, data:[]}`.
- Cache hit does not invoke the worker/queue (spy).

---

## 8. Copy notes

`docs/design/copy-spec.md`: terse, state the number, no marketing slop, no emoji.

- Chart row: `Chart price if saver space is open. hop isn't holding a seat.`
- Do not use "estimated", "about", "up to" on the miles figure — the number is the table
  number. Uncertainty lives in the caveat, not in a fuzzy mile count.
- Do not ship "live bookings" / "redemptions" on observations (FD-copy, still first).
- Verdict hero can still say `Use your Alaska miles` **only** on `availability: 'live'`.
  Chart pick: state the cpp and the caveat; primary CTA `Check X for space`, not `Book
  with X miles`.
- Show HN draft: delete "Seats.aero (live award space)" as a production upstream.

Legal: `app/terms/page.tsx` and `app/privacy/page.tsx` currently name seats.aero. Update
when the key is gone; until then they are an accurate (and damning) description of the
unlicensed feed.

---

## 9. Agent vs founder

| ID | Who | Done means |
|---|---|---|
| **A-terms** | founder | Decision is this doc. Remaining: billing **off** until FD-charts+(key off) *or* leave billing on **after** that lands. Record in ops-runbook §Billing. Agents do not flip `HOP_ENABLE_BILLING` |
| **FD-copy** | agents | Still first. `LiveValuationShelf` observations, not bookings |
| **FD-charts** | agents | Stage A done-means §5. This is N-386 re-specified |
| **FD-live** | agents | Stage B, after gate ④. One program recipe per PR if they are large |
| **A-hn / A-reddit** | founder | After A-terms. Rewrite against chart-cpp (or live, if Stage B beat the post) |
| Production key removal | founder / ops | Vercel Production `SEATS_AERO_API_KEY` unset or flag off. Agents can ship the flag; they cannot edit Vercel |

Do not merge PR #409 / #373 in the same breath. Do not start FD-live before FD-charts is
production. Do not open a design-system PR.

---

## 10. Kill / freeze

| Trigger | Action |
|---|---|
| FD-charts not in production **and** billing still ON **30 days after this plan is adopted** | Next board #1 is "flip billing off." Agents still do not flip it |
| Stage B recipes cannot land UA **and** AS **and** AC (three unsupported) | Stay on chart-cpp. Do not quietly turn seats.aero back on. Do not rent AwardSecrets as a substitute without a new ADR |
| A recipe requires ToS-breaking evasion to work | Leave that program `unsupported`. Chart fill or omit |
| Live scrape put on the Vercel request path | Out of spec. Revert to cache-first + queue |
| Chart tables go stale (deval) | Treat like sweet-spots: dated header + VERIFY-style caveat already on the row. Refresh is a data PR, not an LLM pass |

---

## 11. Files this planning PR touches

| Path | Change | New? |
|---|---|---|
| `docs/plans/2026-08-21-replace-seatsaero.md` | this document | yes |
| `docs/decisions/0014-first-party-award-quotes.md` | build-vs-buy ADR | yes |
| `docs/plans/2026-08-20-path-to-first-dollar.md` | gate ④, A-terms, FD-fallback → FD-charts | no |
| `docs/plans/2026-07-04-business-plan.md` | §3.1 gate ④ + §10 risk + §13 | no |
| `AGENTS.md` | pickup | no |
| `docs/agent-playbook.md` | goal / pickup | no |
| `docs/ops-runbook.md` | billing gate ④ | no |
| `docs/finance/budget.md` | N-320 won't-buy | no |
| `docs/README.md` | index | no |
| `docs/team/routines.md` | Marcus orient | no |
| `docs/solutions/2026-08-21-dont-clone-seatsaero-replace-the-search.md` | compound | yes |

No application code in *this* PR. FD-charts is the next code ticket.

---

## 12. How an LLM agent picks this up

1. Read `AGENTS.md`, the 2026-08-20 first-dollar addendum, then this file, then ADR 0014.
2. **Pickup:** FD-copy if the string is still "live bookings"; else **FD-charts** (this
   file §5) if `lib/awards.ts` does not exist; else FD-live only after ops-runbook shows
   seats.aero off in Production. Skip design-system, skip shipped July 4 B1–B4, skip a
   failover that leaves seats.aero primary.
3. Never generate miles, taxes, or cpp. Never call seats.aero from the paid path. Never
   POST chart rows as valuation observations. Never scrape on the Vercel request path.
4. Founder-gated flags and Vercel secrets: ship the code dark; do not flip production env.
