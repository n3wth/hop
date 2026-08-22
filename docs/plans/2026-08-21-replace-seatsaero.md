# 2026-08-21 — Replace seats.aero (first-party award quotes)

> Plan. Status: **adopted operating decision.** Stage A (chart-cpp) shipped in #415
> (2026-08-22). Gate ④ still needs Production `SEATS_AERO_API_KEY` unset.
> Founder (2026-08-21): do not buy seats.aero commercial terms; the license is unaffordable.
> Build the narrow thing hop actually uses the Partner API for, then take seats.aero off the
> paid path. Does not replace the 2026-07-04 business plan or the 2026-08-20 first-dollar
> addendum — it *amends gate ④ and retires FD-fallback in favor of FD-charts*. ADR: `0014`.

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

**A failover client that keeps seats.aero as primary does not pass gate ④.** Replacement
means **no production hop process** calls the Partner API — `/search`, `/ask`, MCP,
standing-orders, sweet-spot-candidates, `/api/awards`. Not "the paid path." Billing-off
while those still query is still commercial use. Gating the client on `premium` does not
pass. The Production key is **unset** (flag-off with the key left in Vercel is one flip
from primary again). Local `MOCK=1` is unaffected. Keep `lib/seatsaero.ts` in-repo as a
disabled stub (`{ok:false, reason:'disabled'}`, no `fetch`) until deleted; it is **not**
a facade branch.

**Gate ④ is a license check, not a product check.** It passes when the Partner API is
not called and the Production key is unset. Chart quality is not the gate. **That is not
permission to keep billing ON.** Pro's paid line is alerts + MCP quota. Until at least
one program is `availability: 'live'`, those surfaces must not claim space (no "Award
space opened" email on a chart pick; `evaluateOrder` does not cross on
`availability !== 'live'`). Default remaining founder action: **flip billing off now.**
Do not leave it on until charts land. After FD-charts, billing may come back on only if
honest-Pro copy is shipped (④b, §5 done-means 8).

**Do not scrape seats.aero** (site or Partner API without paying). Do not scrape another
award tool's UI. Do not use AwardSecrets / PointsYeah / AwardLogic / ExpertFlyer as an
availability oracle, mileage source, or recipe-training set — including "just the seat
bit" on top of chart-cpp. A substitute landlord is a **founder-owned** ADR, not an
agent-written one.

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
power everyone else's search. Stage B is **unauthenticated public calendar JSON only**.
Login-gated programs stay `unsupported` until a founder-owned ADR (not this plan).

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
/ r/awardtravel drafts must say the chart caveat before they ship (A-hn rewrite, gated
on A-terms *having fired*). v1 tables must keep default `/search` (SFO-LAX) from going
cash-only when seats.aero is off — Alaska NA own-metal saver floor + Aeroplan NA 0–500,
labeled as floors.

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

**ToS is not "the same honesty as credential-sync."** Credential-sync is the user
authorizing hop to read *that user's* balance. Stage B is hop-originated automated
access to airline computers to republish availability. "No evasion" is the CFAA stop
(do not continue past a 403, CAPTCHA, WAF, or login wall) — it does not authorize the
access. A `robots.txt` Disallow, bot block, or program ToS ban → `unsupported` / chart
fill, not a recipe to iterate. First live recipe is a **founder/counsel gate** (ADR 0009
owner class), not an agent ticket. Prefer the **program's own** calendar JSON (or a
documented airline endpoint) over a UI recipe; UI recipes still need that owner gate.
Not a third-party award API. Before any recipe ships, `app/terms` and `app/privacy`
disclose hop automates airline search UIs (Browser Rendering), separate from credential
auto-sync.

Stage B does **not** use `lib/credential-vault.ts`, hop-owned airline logins, or a
shared member session. Worker payload is program + origin/dest/dates only. Cache keys
are global and unauthenticated. Login-gated program → `unsupported` until a new
founder-owned ADR that re-consents, purpose-limits, and caches **per `user_id`**.

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
  ├ quoteChart          lib/award-charts.ts    Stage A — undated quotes, not per-day search
  │                     (lib/awards.ts facade is the only import site)
  └ balances            lib/accounts.ts        unchanged
         │
         ▼
  seats × legs scale, lib/cpp.ts, prefs, pick, verdict
  recordCppObservations  ALLOWLIST availability === 'live' only (unset/chart/seatsaero never POST)
  evaluateOrder          does not cross unless availability === 'live'
  degraded[] 'awards'    only when the configured source returns {ok:false}
```

Stage B (`lib/award-live.ts`, `HOP_ENABLE_LIVE_AWARDS`, worker) is **not in the FD-charts
PR.** Facade in Stage A is: seats.aero stub-disabled → chart. Add `'live'` on the type as
a one-line hook if needed; do not implement the branch.

- **Facade.** `lib/search.ts` and `/api/awards` import from `lib/awards.ts` only. No
  production route imports `lib/seatsaero`. `lib/seatsaero.ts#searchAwards` hard-stubs to
  `{ok:false, reason:'disabled'}` with no `fetch`.
- **Flag.** `HOP_ENABLE_SEATSAERO` stays off. Do not treat flag-off + key-present as
  equivalent to key-unset.
- **Chart contract.** `quoteChart({from,to,cabin})` → one **undated** quote per program
  (not one row per calendar day). Assembler attaches `availability: 'chart'` without
  stamping `depart` as if that day was searched. Stage A is a **calculator**, not a
  replacement for `/partnerapi/search`.
- **`FlightOption`.** `availability?: 'live' | 'chart'`. Cash omits it. UI, MCP
  `verdictSummary`, concierge prompts, and telemetry branch on this field.
- **Copy / alerts.** See §8. `evaluateOrder` does not fire on chart. Email subject is
  never `Award space opened` for chart.
- **Taxes.** Conservative (higher). Missing tax → no row.
- **Miles.** Saver **floors** ("starting at 4,500") overstate cpp if emitted as today's
  quote. Either label the number a saver floor in the row caveat **and** treat it as
  space-unconfirmed *and* price-unconfirmed, or emit a conservative (higher) band
  midpoint. Do not ship 4,500 as if it were a live MileagePlus quote.
- **Sources.** Transcribe numeric facts from the **program's own public page** only.
  Header source URL is the airline/program URL, as-of date. Not seats.aero, AwardSecrets,
  PointsYeah, ExpertFlyer, or a scraper dump. Do not commit PDFs, screenshots, or HTML.
  Facts + citation, climate-normals style. Not legal clearance — "published" ≠ "cleared
  to republish as the award leg of a paid search."
- **Distance.** Do not add `lib/airport-coords.ts`. Put the few lat/lon Stage A needs on
  the existing OurAirports snapshot or a tiny map of origin hubs + `lib/destinations.ts`.
  Avios (the reason for a big coords table) is a **follow-up data PR**, not FD-charts.
  Unknown IATA → no row, not great-circle-as-fact.
- **Empty is not degraded.** `{ok:true, data:[]}`. Copy: `No published saver chart for
  this route.` Never `No award seats came back` on the chart path.
- **Telemetry.** Allowlist `availability === 'live'` only. Chart row with **omitted**
  `availability` must not POST. After cutover, freeze or hide `/stats` live overrides
  until Stage B emits live samples (the 14-program count is pre-cutover seats.aero).
- **MOCK=1.** Fixtures stay. FD-charts tests include one `MOCK=0` assembler run against
  in-memory charts (no network).
- **Sweet-spot mining.** No `SEATS_AERO_API_KEY` → **skip** the run. Do not chart-fill
  candidates.

---

## 5. Stage A — what to build (`FD-charts`)

Pickup after **FD-copy** (the "live bookings" string). One PR if it stays small; split
tables vs. wiring if the snapshot is large.

| Piece | Path | Notes |
|---|---|---|
| Facade | `lib/awards.ts` | Chart only. seats.aero stub-disabled. No live branch |
| Snapshot | `lib/award-charts.ts` | Miles tables + tax bands + any coords this PR needs. One file. Header: program, **airline** source URL, as-of. No LLM |
| Env | `lib/env.ts`, `.env.example` | `HOP_ENABLE_SEATSAERO` off; Production key **unset** |
| Types | `lib/types.ts` | `availability?: 'live' \| 'chart'` |
| Assembler | `lib/search.ts` | Facade; allowlist telemetry; `evaluateOrder` skips chart; `verdictSummary` carries `availability` |
| Copy | `docs/design/copy-spec.md` + VerdictRail + alert email + landing/AskStart | Chart example in copy-spec. Same PR |
| Tests | `lib/__tests__/award-charts.test.ts` + assembler `MOCK=0` in-memory | See §7 |
| Callers | `lib/sweet-spot-candidates.ts` | Skip the run without the seats.aero key. Do not chart-fill |
| Ops | `docs/ops-runbook.md` | Key unset in Production; billing off until honest-Pro |
| Legal | `app/terms`, `app/privacy` | Stop listing seats.aero as a live upstream |

**Coverage for v1 (same PR as the facade — default search is SFO-LAX):**

1. Alaska/Hawaiian NA own-metal distance (SFO-LAX ~337 mi sits in the published **saver
   floor** starting-at 4,500 for &lt;700 mi — label it a floor, not today's price)
2. Aeroplan NA 0–500 (SFO-LAX 6,000 starting-at) and NA–Pacific (SFO-NRT)
3. US domestic tax band + a conservative Japan/Pacific tax band (missing tax → no NRT row)

VS partner, Avios, United-partner bands = **follow-up data PR**. Skip United domestic
dynamic, AA, DL.

**Done means:**

1. **No production hop process** calls the Partner API. Test: `lib/seatsaero.ts` is not
   invoked from any caller when the flag is off; `/api/awards` uses the facade.
2. `MOCK=0` **SFO-LAX** returns at least one chart award (Alaska 4,500 floor or Aeroplan
   6,000), `availability: 'chart'`, cpp from `lib/cpp.ts`, saver-floor caveat on the row.
3. `MOCK=0` **SFO-NRT** also returns at least one chart award (Aeroplan Pacific and/or
   Alaska JAL if that band is in the snapshot).
4. Copy-spec chart example shipped. Hero/CTA/email/MCP/`verdictSummary` cannot be read as
   live space. Empty awards: `No published saver chart for this route.`
5. `recordCppObservations` allowlist: only `availability === 'live'`. Chart with omitted
   field does not POST.
6. Production `SEATS_AERO_API_KEY` **unset**. Record in ops-runbook. **Gate ④ = (1)+(6).**
7. `evaluateOrder` does not cross on chart. Alert copy is cash-vs-chart or silent, never
   `Award space opened` / `Book now`.
8. **④b / honest-Pro (required to keep or re-enable billing):** `/pricing`, landing,
   AskStart, concierge prompts, MCP intro do not claim live award space. July 4 one-liner
   is not used. Stage A line: `hop tells you whether to burn your points — if saver space
   is open.` Billing stays **off** until this ships (founder flips). Agents do not flip it.

**Founder:** flip `HOP_ENABLE_BILLING` **off now**. A-terms is not fired by this decision
doc; it fires when ops-runbook §Billing records billing-off **or** (④ + ④b). "Won't buy,
still on the unlicensed feed" is still a violation.

---

## 6. Stage B — reliable live search (`FD-live`)

Do not start until Stage A is in production, gate ④ has passed, **and founder/counsel
has signed the first recipe.** This is quality, not the license ticket, and not an
unblocked agent pickup.

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
row if miles/taxes missing. No visible-text / innerText dump to cache or logs. "Documented
public endpoint" means the **program's own** search JSON, not a third-party award API.

**Do not use for Stage B:** Cloudflare `/crawl` (site-wide, robots.txt, verified bot —
airline calendars will 403), `/json` Quick Action (Workers AI structured extract),
Stagehand, Firecrawl. Those are content pipelines, not fare engines.

### 6.2 Files

| Piece | Path | Notes |
|---|---|---|
| Worker | `cloudflare/award-search-worker/` | Queue + DO + Browser binding + D1. `RECIPES` starts empty. Bearer secret. **No credentials at all.** Returns only `{program, cabin, miles, taxes, available}` or `{ok:false, reason}` enum — never HTML, innerText, screenshots, or `err.message`. Extract in-worker; cache the structured quote only |
| Client | `lib/award-live.ts` | Cache read only on the request path. Enqueue on miss. `{ok:true, data, pending?: true}` — pending is chart fill, not `degraded[] 'awards'` |
| Merge | `lib/awards.ts` | Live cache hit → `availability:'live'`; else chart |
| Flag | `HOP_ENABLE_LIVE_AWARDS` + worker URL + secret | Double-lock. Off = chart-only |
| Cron hook | standing-orders path | Enqueue `{program, from, to, date}` for active watches. No new cron unless prefetch needs one |
| Tests | mocked queue/cache | Never hit a real airline in CI |

### 6.3 Done means (per program, independently)

1. A verified recipe returns miles, taxes, cabin, and a live availability bit from the
   **program's own** calendar JSON or documented airline search endpoint — not a
   third-party award API. DOM-only recipes are not done.
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
7. Founder/counsel recorded the first recipe as allowed automated access. Terms/privacy
   disclose Browser Rendering against airline search UIs.

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

## 7. Tests (lock these; do not "cover the file")

Stage A:

- Chart lookup for a known band (e.g. Aeroplan distance) returns the table miles, not a
  computed guess beyond the band function.
- Unknown IATA → no row for distance-banded programs (empty, not a throw).
- Missing tax band → no row.
- `cpp(cash, chartTaxes, chartMiles)` matches `lib/cpp.ts` (assembler test, not a second
  formula).
- `HOP_ENABLE_SEATSAERO` off → `lib/seatsaero.ts` not called (mock/spy).
- Allowlist: `recordCppObservations` omitted unless `availability === 'live'` (including
  when the field is omitted).
- `evaluateOrder` does not cross on chart.
- Empty chart (no band) → `{ok:true, data:[]}`; assembler does **not** push `'awards'` to
  `degraded[]`.
- Copy fixture: chart `note` is space-not-confirmed, not "available." Chart pick CTA is
  not `Book with`. Hero is not `Use your X miles` on chart.
- `MOCK=0` assembler against in-memory charts (no network): SFO-LAX and SFO-NRT each
  emit ≥1 chart row.

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

`docs/design/copy-spec.md` is the canon — add a **chart worked example** in the FD-charts
PR (the live-space example stays for `availability: 'live'` / MOCK). Distinctive fact is
**space not confirmed**, not "hop isn't holding a seat" (hop never held seats).

| Slot | Live | Chart |
|---|---|---|
| Kicker | `BEST VALUE` | `CHART · IF SAVER IS OPEN` |
| Headline | `Use your Alaska miles.` | `Alaska chart: 2.6¢/pt.` |
| Hook | `Save $232 vs cash.` | `Save $232 vs cash if saver is open.` |
| Extra | (math) | `Published saver rate. Space not confirmed.` |
| Primary CTA | `Book with Alaska miles` | `Check Alaska for space` |
| Alert subject | `Award space opened: …` | does not send *or* `Cash vs chart: … now 3.1¢/pt` — never `Award space opened` / `Book now` |

Do not use `estimated` / `about` / `up to` on the miles figure. Saver-floor uncertainty
lives in the caveat. `You have the miles` (balance fact) may stay; `Use your Alaska miles`
(spend instruction) may not, on chart.

**A-hn (chart-cpp is OK; do not lead with the hole):** after A-terms has *fired* (ops-runbook
records billing-off or ④+④b). Demo URL is a **charted** search (SFO-NRT or SFO-LAX with
the floor caveat), not a domestic AA/DL/UA-mainline miss. Do not name seats.aero. Do not
use the July 4 one-liner. Do not lead with observed cpp (chart rows are banned from
telemetry). Engine first, then one-sentence caveat, then MCP.

Suggested first beats:

> You give hop a route and your real balances. It takes today's cash fare, the published
> saver chart, and computes cents-per-point. Every figure is `cpp = (cash − taxes) × 100
> / miles`, never an LLM.
>
> It does not check whether saver space is open. If that space is there, is it a good
> burn of the miles you actually hold?

**A-reddit launch post waits for Stage B** (at least UA or AS live). Until then, only the
weekly math-reply habit.

Legal: `app/terms` / `app/privacy` drop seats.aero as a live upstream when the key is
gone. Before Stage B recipes: disclose Browser Rendering against airline search UIs.

---

## 9. Agent vs founder

| ID | Who | Done means |
|---|---|---|
| **A-terms** | founder | Not this decision doc. Fires when ops-runbook §Billing records **billing off** *or* (gate ④ + ④b). Default now: flip billing off. Agents do not flip `HOP_ENABLE_BILLING` |
| **FD-copy** | agents | Still first. `LiveValuationShelf` observations, not bookings |
| **FD-charts** | agents | Stage A done-means §5. N-386 re-specified. If Linear still says "failover" / "written terms," **this doc wins** |
| **FD-live** | founder gate, then agents | After ④. Counsel on first recipe. Unauthenticated calendar JSON only |
| **A-hn** | founder | After A-terms *fired*. Engine-first, charted demo URL, no July 4 one-liner, no seats.aero |
| **A-reddit** | founder | Launch post waits for Stage B; math replies OK now |
| Production key removal | founder / ops | Vercel Production `SEATS_AERO_API_KEY` **unset** |

Do not merge PR #409 / #373 in the same breath. Do not start FD-live before FD-charts is
production. Do not open a design-system PR.

---

## 10. Kill / freeze

| Trigger | Action |
|---|---|
| FD-charts not in production **and** billing still ON **now** (do not wait 30 days) | Founder flips billing off. Agents still do not |
| Stage B recipes cannot land UA **and** AS **and** AC | Stay on chart-cpp. Do not turn seats.aero back on. Do not compose AwardSecrets "just for seats" with chart miles. Substitute landlord = founder-owned ADR only |
| A recipe requires bypassing a 403/CAPTCHA/WAF/login wall | `unsupported`. Chart fill. Not a retry |
| Zero live programs 90 days after FD-charts | Stage A one-liner stays; July 4 one-liner stays retired; Pro is cash-vs-chart watches or billing off |
| Live scrape put on the Vercel request path | Out of spec. Revert to cache-first + queue |
| Chart tables go stale (deval) | Treat like sweet-spots: dated header + VERIFY-style caveat already on the row. Refresh is a data PR, not an LLM pass |

---

## 11. Files this planning PR touches

| Path | Change | New? |
|---|---|---|
| `docs/plans/2026-08-21-replace-seatsaero.md` | this document | yes |
| `docs/decisions/0014-first-party-award-quotes.md` | build-vs-buy ADR | yes |
| `docs/plans/2026-08-20-path-to-first-dollar.md` | gate ④, A-terms, FD-fallback → FD-charts | no |
| `docs/plans/2026-07-04-business-plan.md` | §3.1 gate ④ (drop "parity") + §7 owner line + §11 pickup | no |
| `AGENTS.md` | pickup; gate ④ ≠ chart quality | no |
| `docs/agent-playbook.md` | goal / pickup / N-320 remaining | no |
| `docs/ops-runbook.md` | billing gate ④; flip off now | no |
| `docs/finance/budget.md` | N-320 won't-buy | no |
| `docs/README.md` | index | no |
| `docs/team/routines.md` | Marcus orient | no |
| `docs/solutions/2026-08-20-first-dollar-is-distribution-not-product.md` | license state, not fallback-at-parity | no |
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
