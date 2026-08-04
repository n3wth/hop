---
title: "feat: hop — flight points-vs-cash optimizer web app"
type: feat
status: superseded
date: 2026-06-28
---

> Superseded by [docs/plans/2026-07-03-critical-review-roadmap.md](2026-07-03-critical-review-roadmap.md).

# feat: hop — flight points-vs-cash optimizer web app

This plan is a detailed implementation artifact from initial build planning.
Use it as historical context and decision rationale; validate assumptions against current code before executing any unit verbatim.

## Overview

`hop` is a flight search engine that compares cash fares against points/miles redemptions across
loyalty programs, computes cents-per-point (CPP) for every option, and recommends the optimal
booking method ("Use points" vs "Pay cash"). It pulls the user's live balances from AwardWallet,
award availability from Seats.aero, and cash prices from Duffel, then ranks results by CPP and
surfaces a single "Our pick." Every row carries a booking link (airline.com for points, affiliate
deep-link for cash) so the site earns commission.

Build target: production Next.js (App Router) + Tailwind v4, deployed to `hop.n3wth.com` on Vercel.
The locked visual design is the warm teal/mint Auro-inspired flat app-shell finalized as `hop-v9.html`.

**Target repo:** `hop` (new repo at `~/code/hop`; all paths below are repo-relative).

---

## Problem Frame

Award travel optimization is manual and tedious: a points-savvy traveler must check cash prices on
one site, award availability on another, their own balances on a third, then do CPP math by hand to
decide whether points or cash is the better deal on a given route. `hop` collapses that into one
results page that does the comparison and states the verdict. The user is Oliver (single-user v1):
he holds ~618K points across 6 programs and prefers points when CPP exceeds ~2.5¢.

The product thesis is the **verdict**: the UI must boldly answer "should I use points or cash here?"
— not just list options.

---

## Requirements Trace

- R1. Results page matches the locked `hop-v9.html` design (teal/mint flat app-shell: square bunny
  logo cell, icon-only rail, search built into the full-height topbar, verdict rail, integrated
  results plane with "Our pick" + CPP-color-coded rows, right-rail points panel).
- R2. CPP engine computes `cpp = (cash_price − taxes) × 100 ÷ miles_required` per award option and
  color-codes: ≥3.0 green (use points), 1.5–3.0 amber (either way), <1.5 muted/red (pay cash).
- R3. Results sorted by CPP descending; best option surfaced as "Our pick" with the verdict banner.
- R4. Live cash prices from Duffel (server-side). [Kiwi is MCP-only and unavailable in prod — see
  Key Technical Decisions; Kiwi is used as affiliate deep-link only.]
- R5. Live award availability from Seats.aero across programs (server-side).
- R6. Live points balances from AwardWallet (server-side).
- R7. Transfer-partner logic: when a program is reachable by transfer (Amex MR / Chase UR / Bilt →
  partners), surface "Transfer & book" with the source program.
- R8. Every result row has a working booking action (airline.com for points; affiliate deep-link
  for cash).
- R9. Responsive: desktop app-shell (rail + topbar + two-column stage); mobile single-column with
  the rail collapsed and search accessible.
- R10. Deployed and publicly accessible at `hop.n3wth.com` with env vars configured on Vercel.
- R11. Graceful degradation: any single upstream failure (Duffel / Seats.aero / AwardWallet) yields
  a partial, labeled result, never a blank page or crash.

**Origin acceptance examples:** (derived from brief)
- AE1 (R2, R3): SFO→LAX with Alaska award at 4,500 mi vs $254 cash → 5.6¢/pt, ranked #1, "Our pick,
  Use points, Save $254."
- AE2 (R2): United dynamic award at 14,100 mi / 1.8¢ → muted, "Pay cash instead" action.
- AE3 (R7): United award reachable via Aeroplan → "Transfer & book", shows Amex MR/Chase UR source.
- AE4 (R11): Seats.aero timeout → cash results still render with an "award data unavailable" note.

---

## Scope Boundaries

- No user authentication in v1 — single-user (Oliver's AwardWallet balances), public results page.
- No booking *execution* — `hop` links out to airline.com / affiliate URLs; it does not transact.
- No multi-passenger fare classes beyond adult count passthrough; no seat selection.
- No historical price tracking, alerts, or saved searches in v1.
- Kiwi Tequila REST price API is out of scope (no Tequila key); Kiwi = deep-link affiliate only.

### Deferred to Follow-Up Work

- Multi-user auth (Auth0 — tenant already exists per user memory): separate iteration.
- ISR caching of route results: add after live integrations are stable.
- Real airline logo marks (vs monogram tiles): polish pass once layout is locked in code.

---

## Context & Research

### Relevant Code and Patterns

- Locked design: `hop-v9.html` (bundled in `docs/design/` at scaffold time) — authoritative for
  layout, palette tokens, spacing, the integrated-plane treatment, and component structure.
- Logo: `hop-logo.svg` (single-path teal bunny, `viewBox 0 0 462 466`, fill `#19545D`).
- Icons: Material Symbols Rounded **filled** (`viewBox 0 -960 960 960`). Bundled set in
  `icons.json`. NOTE: known render bug in v9 — these icons use a `0 -960 960 960` viewBox; any
  component rendering them must use that viewBox or the glyph clips to blank (caused the empty
  search button / verdict check / bell in v9). Fix when porting.

### Institutional Learnings

- n3wth ecosystem map (user memory): each site = domain → Vercel → repo → local checkout. Follow
  that: `hop.n3wth.com` → Vercel project `hop` → repo `~/code/hop`.
- Tailwind v4 (user CLAUDE.md): check version first; v4 uses `@import "tailwindcss"`, `@theme` in
  CSS, `@source` directive — NOT a `tailwind.config.js` theme block. Design tokens go in `@theme`.
- Design rules (user CLAUDE.md): flat by default, no glows/shadows/gradients. v9 already complies.

### External References

- Next.js App Router (current): Route Handlers in `app/api/*/route.ts` for server-side calls (no
  CORS, keys stay server-side). Server Components for the shell; a Client Component for interactive
  search/tabs/sort state.
- Vercel env vars: set via `vercel env` or dashboard; pull locally with `vercel env pull`.
- Duffel API: `POST /air/offer_requests` then read offers; live key `DUFFEL_API_KEY_LIVE`. Requires
  `Duffel-Version` header.
- Seats.aero Partner API: `GET /availability` (cached search) keyed by `SEATS_AERO_API_KEY`.
- AwardWallet: balances via API key + user id (`AWARDWALLET_API_KEY`, `AWARDWALLET_USER_ID`).

### Points Valuation Reference (for transfer suggestions and fallbacks)

Amex MR 2.0 / Chase UR 2.0 / Bilt 2.0 / Alaska 1.8 / BA Avios 1.5 / Southwest 1.5 cpp.
Transfer partners: Amex MR → Aeroplan, BA Avios, Delta, Virgin Atlantic. Chase UR → United,
Southwest, BA Avios, Aeroplan. Bilt → Alaska, United, BA Avios, Aeroplan.

---

## Key Technical Decisions

- **Next.js App Router + Tailwind v4 + TypeScript.** Matches brief and n3wth conventions. Tailwind
  v4 `@theme` tokens carry the locked palette so design = tokens, not magic hex in components.
- **Server Route Handlers for all upstreams.** Duffel/Seats.aero/AwardWallet called only server-side
  so keys never reach the client and there's no CORS. One aggregator route composes them.
- **Kiwi = affiliate deep-links only (not a price source in prod).** Kiwi is exposed via MCP in the
  authoring session, not in deployed Vercel functions. Cash prices therefore come from **Duffel**;
  Kiwi contributes booking deep-links for commission. This is the one deviation from "all live" and
  is intentional and documented (R4).
- **Aggregator fan-out with per-source isolation.** `/api/search` fans out to the three live sources
  in parallel; each is wrapped so a failure/timeout returns a typed `{ ok:false, reason }` partial
  rather than rejecting the whole response (R11).
- **CPP engine is a pure, unit-tested module** (`lib/cpp.ts`) — no I/O, deterministic, the core
  correctness surface. Same for transfer logic (`lib/transfers.ts`).
- **Normalized result model** (`lib/types.ts`) is the contract between API layer and UI: every option
  (cash or award) maps to one `FlightOption` shape the result row renders, so the UI never branches
  on source.
- **Mock fixtures behind a flag** (`MOCK=1`) so the UI and engine are buildable/testable without live
  keys and the deploy can render even if an upstream is down during build. Live is default.

---

## Open Questions

### Resolved During Planning

- Repo location: `~/code/hop`, new git repo. (User confirmed "go".)
- Cash price source in prod: Duffel (Kiwi MCP unavailable in prod). (See Key Technical Decisions.)
- Auth: none in v1, single-user. (User confirmed.)
- Live vs mock: live by default; mock behind `MOCK=1` for build/test resilience.

### Deferred to Implementation

- Exact Seats.aero response field mapping (program codes, taxes) — confirm against a live call.
- Duffel offer→`FlightOption` mapping details (taxes breakdown) — confirm against a live offer.
- Whether AwardWallet returns all 6 programs in one call or needs per-account fetches — confirm live.

---

## Output Structure

    hop/
    ├── app/
    │   ├── layout.tsx                  # root: Inter font, <body> shell
    │   ├── globals.css                 # Tailwind v4 @import + @theme tokens
    │   ├── page.tsx                    # results page (Server Component shell)
    │   └── api/
    │       ├── search/route.ts         # aggregator fan-out
    │       ├── cash/route.ts           # Duffel
    │       ├── awards/route.ts         # Seats.aero
    │       └── balances/route.ts       # AwardWallet
    ├── components/
    │   ├── AppShell.tsx                # grid: logo cell + topbar + rail + stage
    │   ├── Logo.tsx                    # bunny svg
    │   ├── Icon.tsx                    # Material Symbols filled (correct viewBox)
    │   ├── SearchBar.tsx               # built-in topbar search (client)
    │   ├── Rail.tsx                    # icon-only nav
    │   ├── VerdictRail.tsx             # verdict + stats strip
    │   ├── ResultsList.tsx             # integrated plane: pick banner + rows (client: tabs/sort)
    │   ├── ResultRow.tsx               # one FlightOption row
    │   └── PointsPanel.tsx             # right-rail balances
    ├── lib/
    │   ├── types.ts                    # FlightOption, SearchParams, ApiResult
    │   ├── cpp.ts                      # CPP calc + color tier
    │   ├── transfers.ts               # transfer-partner logic
    │   ├── duffel.ts                   # Duffel client + normalize
    │   ├── seatsaero.ts                # Seats.aero client + normalize
    │   ├── awardwallet.ts              # AwardWallet client + normalize
    │   ├── booking.ts                  # booking/affiliate link builders
    │   └── mock.ts                     # fixtures behind MOCK flag
    ├── lib/__tests__/                  # cpp.test.ts, transfers.test.ts, normalize tests
    ├── public/                         # logo asset, favicon
    ├── docs/design/hop-v9.html         # locked design reference
    └── (config: package.json, tsconfig, next.config, vitest config, .env.local from vercel pull)

---

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation
> specification. The implementing agent should treat it as context, not code to reproduce.*

```
SearchBar (client) --route+dates--> /api/search (aggregator)
                                        │  fan out in parallel, isolate failures
                 ┌──────────────────────┼───────────────────────┐
                 ▼                       ▼                        ▼
          /api/cash (Duffel)   /api/awards (Seats.aero)   /api/balances (AwardWallet)
                 │                       │                        │
                 ▼                       ▼                        ▼
          CashOption[]            AwardOption[]            Balance[] (by program)
                 └───────────┬───────────┘                        │
                             ▼                                     │
                  lib/cpp: for each award, cpp = (cash−tax)*100/miles
                  lib/transfers: annotate transfer paths           │
                             ▼                                     ▼
                  FlightOption[] (normalized, cpp, tier, balance-matched, bookingUrl)
                             ▼
                  sort by cpp desc → pick = max → verdict = pick.tier≥amber ? "Use points":"Pay cash"
                             ▼
                  page renders: VerdictRail + ResultsList(pick banner + rows) + PointsPanel
```

Failure isolation: each source wrapped → `{ok:true,data} | {ok:false,reason}`. Aggregator always
returns 200 with whatever succeeded plus a `degraded: string[]` list the UI surfaces as notes.

---

## Implementation Units

- U1. **Scaffold Next.js + Tailwind v4 + tooling**

**Goal:** Create the repo skeleton that builds and deploys empty-but-valid.

**Requirements:** R1 (foundation), R10 (foundation).

**Dependencies:** None.

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `app/layout.tsx`, `app/globals.css`,
  `app/page.tsx` (placeholder), `vitest.config.ts`, `.gitignore`, `docs/design/hop-v9.html`.

**Approach:**
- `create-next-app` (App Router, TS, no src dir) then add Tailwind v4 (`@import "tailwindcss"`,
  `@theme` block). Inter via `next/font`. Vitest for the pure-logic tests.
- Put the locked palette into `@theme` tokens (brand `#0d6e6e`, brand-deep `#0a5757`, brand-light,
  brand-tint, cream bg `#f3f1ec`, surface, sunk, border ramp, green `#15803d`, amber `#b45309`,
  text ramp). Radii and the `--sq:76px` shell square.

**Patterns to follow:** Tailwind v4 `@theme` (user CLAUDE.md note). Flat design rules.

**Test scenarios:** `Test expectation: none — scaffolding`. Verify: `npm run build` succeeds; dev
server renders the placeholder.

**Verification:** Clean `next build`; Tailwind tokens resolve in a smoke component.

---

- U2. **Domain types + CPP engine + transfer logic (pure, tested)**

**Goal:** The correctness core: normalized model, CPP math, color tiers, transfer partners.

**Requirements:** R2, R3, R7.

**Dependencies:** U1.

**Files:**
- Create: `lib/types.ts`, `lib/cpp.ts`, `lib/transfers.ts`.
- Test: `lib/__tests__/cpp.test.ts`, `lib/__tests__/transfers.test.ts`.

**Approach:**
- `FlightOption` unifies cash + award: `{ id, kind:'cash'|'award'|'transfer', program?, airline,
  route, date, durationMin?, miles?, taxes?, cashPrice?, cpp?, tier, youHave?, bookingUrl, note? }`.
- `cpp(cashPrice, taxes, miles)` → number; guards: miles≤0 or missing cash → undefined cpp.
- `tier(cpp)` → `'green'|'amber'|'muted'` per thresholds (≥3.0 / 1.5–3.0 / <1.5).
- `transfers(program, balances)` → list of `{ source, ratio? }` for reachable partners.

**Execution note:** Implement test-first — this is the deterministic correctness surface.

**Test scenarios:**
- Happy: Covers AE1. cpp(254, 11.2, 4500) ≈ 5.4 → green; ranks above lower cpp.
- Happy: tier boundaries — 3.0 → green, 2.9 → amber, 1.5 → amber, 1.49 → muted.
- Edge: miles=0 → cpp undefined, tier muted, no divide-by-zero.
- Edge: missing cashPrice → cpp undefined (award still listed, no verdict claim).
- Covers AE3: transfers('United MileagePlus reachable via Aeroplan', balances with Amex MR) →
  includes Amex MR and Chase UR sources.
- Edge: transfers for a program with zero reachable sources → empty list.

**Verification:** All engine tests pass; thresholds match brief exactly.

---

- U3. **API clients + normalization (Duffel, Seats.aero, AwardWallet) + mock fixtures**

**Goal:** Server-side clients that fetch and normalize each upstream into the shared model, with a
mock mode.

**Requirements:** R4, R5, R6, R11.

**Dependencies:** U2.

**Files:**
- Create: `lib/duffel.ts`, `lib/seatsaero.ts`, `lib/awardwallet.ts`, `lib/booking.ts`, `lib/mock.ts`.
- Test: `lib/__tests__/normalize.test.ts` (against captured/sample payloads).

**Approach:**
- Each client: typed fetch with timeout + the right auth header; returns
  `{ok:true,data}|{ok:false,reason}`. Never throws to the caller.
- Normalizers map raw → `FlightOption[]` / `Balance[]`. `booking.ts` builds airline.com points URLs
  and the cash affiliate deep-link (Kiwi/Travelpayouts).
- `mock.ts` returns the SFO→LAX fixture matching the v9 sample data, gated by `MOCK=1`.

**Execution note:** Characterize normalizers against sample payloads before wiring live (field maps
are the deferred unknowns).

**Test scenarios:**
- Happy: Duffel sample offer → CashOption with price + taxes populated.
- Happy: Seats.aero sample → AwardOption[] with program, miles, taxes.
- Happy: AwardWallet sample → 6 Balance rows matching the known programs.
- Error: each client on non-200/timeout → `{ok:false, reason}`, no throw.
- Edge: empty award list → `[]`, not undefined.
- `MOCK=1` → fixtures returned without network.

**Verification:** Normalizer tests green on samples; clients compile and isolate failures.

---

- U4. **Aggregator route `/api/search` (fan-out, isolate, assemble, rank)**

**Goal:** One endpoint that composes the clients + engine into the page's data contract.

**Requirements:** R3, R4, R5, R6, R7, R11.

**Dependencies:** U2, U3.

**Files:**
- Create: `app/api/search/route.ts`, `app/api/cash/route.ts`, `app/api/awards/route.ts`,
  `app/api/balances/route.ts`.
- Test: `app/api/search/__tests__/route.test.ts`.

**Approach:**
- `/api/search?from&to&depart&return&adults` → parallel calls → for each award compute cpp/tier,
  match `youHave` from balances, annotate transfers → sort by cpp desc → pick = top → verdict.
- Always 200; include `degraded: string[]` for any source that failed.
- Per-source single-purpose routes exist for debugging/direct use.

**Test scenarios:**
- Happy: Covers AE1. SFO→LAX (mock) → Alaska pick, verdict "Use points", save = cash−0.
- Integration: Covers AE4. Seats.aero source forced to fail → 200, cash rows present,
  `degraded` includes 'awards'.
- Edge: no results from any source → 200 with empty list + degraded notes (UI shows empty state).
- Happy: ranking — options returned sorted by cpp desc; pick is first.

**Verification:** Route returns the assembled contract; failure isolation proven by test.

---

- U5. **Design system port: tokens, AppShell, Logo, Icon, Rail**

**Goal:** Port the v9 shell to Tailwind components — the square logo cell, topbar, icon rail, grid.

**Requirements:** R1, R9.

**Dependencies:** U1.

**Files:**
- Create: `components/AppShell.tsx`, `components/Logo.tsx`, `components/Icon.tsx`,
  `components/Rail.tsx`; extend `app/globals.css` `@theme`.

**Approach:**
- AppShell = CSS grid `[--sq] 1fr / [--sq] 1fr` (logo cell square, topbar = square height, rail =
  square width) exactly as v9.
- `Icon.tsx` renders Material Symbols filled with the **correct `0 -960 960 960` viewBox** (fixes the
  v9 blank-glyph bug). `Logo.tsx` inlines the bunny svg.
- Mobile: collapse rail, stack stage (v9 breakpoint at 980px).

**Patterns to follow:** `hop-v9.html` markup/CSS 1:1; flat (no shadows).

**Test scenarios:**
- Happy: AppShell renders logo cell + topbar + rail + stage slots.
- Edge: Icon with each named glyph renders non-empty path (guards the viewBox regression).
- `Test expectation: visual` — verified via screenshot in U8.

**Verification:** Shell visually matches v9 top-left corner module and rail; icons not blank.

---

- U6. **Results UI: VerdictRail, ResultsList, ResultRow, PointsPanel, SearchBar**

**Goal:** Port the data-bearing UI and bind it to the search contract.

**Requirements:** R1, R2, R3, R8, R9.

**Dependencies:** U4, U5.

**Files:**
- Create: `components/VerdictRail.tsx`, `components/ResultsList.tsx`, `components/ResultRow.tsx`,
  `components/PointsPanel.tsx`, `components/SearchBar.tsx`; wire `app/page.tsx`.

**Approach:**
- `page.tsx` (Server Component) fetches `/api/search` (default SFO→LAX or query params) and passes
  the assembled model down. `ResultsList` + `SearchBar` are Client Components (tabs, sort, search
  state). `ResultRow` renders one `FlightOption`; tier drives the value color; transfer kind shows
  "Transfer & book"; cash shows price/earn; pick row gets the brand-tint band + banner.
- `VerdictRail` renders verdict + the four stats. `PointsPanel` lists balances with monogram chips
  + total. Booking buttons use `lib/booking.ts` URLs (R8).
- Empty/degraded states: render notes from `degraded`.

**Test scenarios:**
- Happy: Covers AE1. pick row shows 4,500 mi, 5.6¢/pt green, "Book points", banner "Save $254".
- Happy: Covers AE2. muted row shows "Pay cash instead" action.
- Happy: Covers AE3. transfer row shows "Transfer & book" + source program.
- Edge: empty results → friendly empty state, no crash.
- Happy (R8): each row's booking link has correct href (points → airline.com, cash → affiliate).
- `Test expectation: component/render tests` for ResultRow tier→color + action mapping.

**Verification:** Page renders the full v9 layout bound to real/mock data; booking links resolve.

---

- U7. **Wire live data + env + graceful degradation end-to-end**

**Goal:** Flip from mock to live, load keys, prove the whole path with real upstreams.

**Requirements:** R4, R5, R6, R10, R11.

**Dependencies:** U4, U6.

**Files:**
- Create: `.env.local` (from `vercel env pull` / copied from toolkit `.env`), `lib/env.ts`
  (typed env access). Modify clients to read env.

**Approach:**
- Map toolkit keys: `DUFFEL_API_KEY_LIVE`, `SEATS_AERO_API_KEY`, `AWARDWALLET_API_KEY`,
  `AWARDWALLET_USER_ID`. Resolve the deferred field-mapping unknowns against live responses; adjust
  normalizers. Confirm degradation: kill one key → partial result still renders.

**Execution note:** This unit is where deferred field-mapping unknowns (U3) get resolved against
real payloads.

**Test scenarios:**
- Integration: live `/api/search` returns ≥1 cash option for a real route.
- Integration: live balances populate `youHave` on matching programs.
- Integration: Covers AE4. One key removed → 200 + degraded note, page still renders.

**Verification:** Live results render real data; no key reaches the client bundle (grep build output).

---

- U8. **Visual QA against v9 + responsive**

**Goal:** Confirm the built app matches the locked design at desktop and mobile.

**Requirements:** R1, R9.

**Dependencies:** U6 (U7 ideally).

**Files:** Modify: any component for fidelity fixes. Add: `scripts/shot.mjs` (Playwright screenshot
harness, mirrors the authoring workflow).

**Approach:** Screenshot the running app at 1440 and 390 widths; diff against `hop-v9.html` render;
fix spacing/color/viewBox drift. Verify no shadows/gradients (flat rule).

**Test scenarios:** `Test expectation: visual QA` — desktop matches v9 corner module, verdict rail,
pick banner, CPP colors; mobile collapses cleanly; icons render (no blanks).

**Verification:** Side-by-side screenshots match; responsive breakpoint clean.

---

- U9. **Deploy to Vercel at hop.n3wth.com**

**Goal:** Public production deploy with env configured.

**Requirements:** R10.

**Dependencies:** U7, U8.

**Files:** Create: `vercel.json` if needed; README with deploy + env notes.

**Approach:** `vercel` project `hop`; set the four env vars (+ `MOCK` unset/0) in Vercel; assign
`hop.n3wth.com` (DNS via the n3wth Vercel pattern). Deploy preview → verify → promote to prod →
attach domain.

**Test scenarios:** `Test expectation: deployment smoke` — prod URL loads, runs a live search,
booking links work, no key leakage in client bundle.

**Verification:** `https://hop.n3wth.com` serves the live app; search returns real data.

---

## System-Wide Impact

- **Interaction graph:** `page.tsx` → `/api/search` → 3 clients + engine. SearchBar (client) drives
  re-query via query params. No shared mutable state; each request is stateless.
- **Error propagation:** every upstream failure is converted to a typed partial at the client layer
  and surfaced as a `degraded` note; nothing throws to the page. (R11)
- **State lifecycle risks:** none persistent in v1 (no DB, no auth, no writes). Stateless reads only.
- **API surface parity:** the `/api/cash|awards|balances` debug routes must stay in sync with the
  same normalizers used by `/api/search` — share the `lib/*` clients, don't duplicate.
- **Integration coverage:** aggregator failure-isolation and live field mapping are the scenarios
  unit tests alone won't prove — covered in U4 (mock) and U7 (live).
- **Secret safety:** keys only in `lib/*` server modules + Route Handlers; verify they never enter a
  Client Component or the client bundle.

---

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Kiwi unavailable in prod (MCP-only) | Documented decision: Duffel = cash source, Kiwi = deep-link only (R4). |
| Upstream field maps differ from assumptions | Normalizers characterized on samples (U3), resolved live (U7); deferred unknowns called out. |
| One upstream slow/down breaks page | Per-source isolation + `degraded` notes; always 200 (R11, U4). |
| Material Symbols viewBox blank-glyph bug (seen in v9) | `Icon.tsx` uses correct `0 -960 960 960` viewBox; U5 test guards it. |
| Tailwind v4 differences from v3 muscle memory | `@theme`/`@import` tokens per user note; no `tailwind.config` theme block. |
| Secret leakage into client bundle | Keys confined to server modules; U7 verifies no leakage in build output. |
| DNS/domain attach friction | Follow established n3wth Vercel→domain pattern; preview-first then promote. |

---

## Phased Delivery

### Phase 1 — Buildable UI on real model (mock-capable)
U1 scaffold → U2 engine → U5 shell → U6 results UI bound to `/api/search` running in `MOCK=1`.
Outcome: the locked design, live in a browser, on the real data contract.

### Phase 2 — Live integrations
U3 clients → U4 aggregator → U7 live wiring. Outcome: real Duffel/Seats.aero/AwardWallet data.

### Phase 3 — QA + ship
U8 visual/responsive QA → U9 deploy to `hop.n3wth.com`. Outcome: public, live, verified.

---

## Sources & References

- Brief: `/Users/n3wth/tmp/claude-prompt.md` (full data model, commission model, valuations).
- Locked design: `hop-v9.html` (bundled to `docs/design/hop-v9.html`).
- Logo: `hop-logo.svg`. Icons: `icons.json` (Material Symbols Rounded filled).
- Env keys: `/Users/n3wth/travel-hacking-toolkit/.env`.
- Agent-team structure: Design / API Integration / Points Engine / Orchestrator (from brief).
