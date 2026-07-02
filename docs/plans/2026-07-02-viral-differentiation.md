# Viral differentiation — shareable verdict receipts (`/v/[id]`), the flywheel into a live valuations index

> Plan. Status: proposal.
> TL;DR: hop's flagship shareable artifact is the **verdict receipt** — a permalink + OG card
> showing the engine-computed math for one real trip ("Use points — 60k at 2.9¢/pt beats $840
> cash. Save $412."), created only by explicit user action, containing zero personal data by
> construction, snapshotted at share time so the card can never disagree with itself or re-bill
> upstream APIs. Phase 1 ships that this week behind `HOP_ENABLE_SHARE_RECEIPTS`. The bigger
> artifact — the public **live point-valuations index** — is deliberately Phase 2, because ADR
> 0005's ≥20-sample trust gate means its headline claim ("measured, live") would be false at
> launch today; receipts *feed* it (every share re-runs `assembleSearch`, which emits cpp
> observations), so Phase 1 is also Phase 2's data engine.

Synthesis provenance: risk-first draft (winner) + grafts from the engine-first and surface-first
drafts per the judge panel. Every conflict is resolved explicitly below, with the losing option
named so a reviewer doesn't re-litigate it.

Grounding: the verified competitive research (`docs/plans/2026-07-02-competitive-positioning.md`)
is **not in this worktree** — it was read from commit `7c40602` (merged after this branch was
cut). Its verified findings: hop is the only product found combining real balances +
deterministic engine-computed verdicts + agent-native MCP distribution; nearest analogs (Gondola,
Points Path, Seats.aero/Award Travel Finder) each hold at most one leg; the AI-planner wave is
loyalty-blind and hallucination-prone; award tools cluster $79–130/yr. The receipt is that
positioning as a screenshot: *a number an AI planner cannot fake, in the card format
r/awardtravel threads already improvise in text.*

### The angle decision (pick one — evaluated failure-first)

| Candidate | Failure analysis | Verdict |
|---|---|---|
| **(2) Verdict receipts** | Every failure mode has a clean degrade (catalog in §6). Snapshot-at-share-time eliminates the two killers: OG crawlers triggering paid upstream fan-outs, and a card showing different numbers than the page. Privacy is structural (balance-free engine re-run), not procedural. One-week slice on existing plumbing (`lib/og.tsx`, `assembleSearch`, `withDb`). | **Phase 1 — build now** |
| (1) Live valuations index | Engineering is easy but the *claim* fails at launch: `HOP_ENABLE_VALUATION_SYNC` is not yet enabled in prod and `MIN_SAMPLES_TO_TRUST = 20` per program × freshness window means ~zero live rows on day one — a "measured, live" page showing only the static baseline is TPG-with-extra-steps and burns the one chance to launch the claim. Observed cpp also skews high (best-option-per-search — a ceiling-ish measure), so the methodology page must exist before the numbers do. | **Phase 2** — launch when the sync seam is on and ≥5 programs clear the trust gate (owner call on N). Receipts accelerate this: each share is a fresh `assembleSearch` → `recordCppObservations` (`lib/search.ts:220`) when the seam is enabled. Concrete pointers recorded in §9 so Phase 2 starts warm. |
| (3) Roast my wallet / report card | The content *is* the user's balances — the privacy surface Phase 1 deliberately has none of. The "grade" is a new derived number needing its own deterministic spec + tests. Reuses the exact snapshot/permalink/OG spine Phase 1 builds. | **Phase 3** — on the Phase 1 spine, banded balances only, explicit share action |
| (4) MCP/agent PR angle | Not a product artifact; already sequenced in the competitive plan (registry submissions, stateful-vs-stateless copy). One zero-cost piggyback lands here anyway: the receipt footer line "Every number computed, never generated — by the same engine any AI agent can call." | Out of scope — owned by the competitive plan, except the footer line |

## 1. Requirements (Phase 1 — done means)

- [ ] On a `/search` results page with a clean verdict, a quiet `Share this verdict` affordance
      creates a permalink `/v/<id>` and copies it (or invokes `navigator.share` on mobile).
      Signed-in **and** signed-out users can share (zero-friction virality), rate-limited.
- [ ] `/v/<id>` renders a flat-editorial receipt card **entirely from the stored snapshot** —
      route, dates, cabin, verdict headline, the stat row (miles · ¢/pt with tier color · cash ·
      $ saved), best program, a `Priced <date>` line, methodology one-liner, and a
      `Run this route yourself` CTA linking to the live `/search` URL with `ref=receipt`. Zero
      upstream API calls at view time.
- [ ] `app/v/[id]/opengraph-image.tsx` renders the same numbers as a 1200×630 card from the same
      snapshot — screenshot-native for reddit/iMessage/Slack unfurls.
- [ ] **No number on a receipt can originate from a client.** The share action accepts *only*
      trip params; the server re-runs `assembleSearch` (balance-free, prefs-free) and snapshots
      that result. A hostile client cannot mint a "$5,000 saved" card with hop's brand on it.
- [ ] **No personal data can enter a receipt.** The `VerdictSnapshot` type structurally cannot
      hold balances, identity, prefs, `youHave`, `action`, or `bookingUrl` (omission in the type
      = compile error); the engine run passes `undefined` balances and `undefined` prefs.
      `created_by` (Auth0 sub, nullable) is stored for abuse-forensics only and never selected
      into any render path.
- [ ] **Strict degraded gate (graft, replaces the winner's pay-cash carve-out):** a receipt is
      minted only when `degraded.length === 0` **and** the verdict is not `'none'` **and** the
      needed numbers are present. A public "Pay cash" card minted while the award side was dark
      may be a false verdict; the honesty note doesn't cure a wrong answer. Two of three judges
      independently called this; the simpler gate also deletes a conditional and the receipt-side
      `DegradedNote` state entirely.
- [ ] Idempotent: re-sharing the same trip on the same UTC day returns the same `/v/<id>`
      (content-hash unique index), so double-clicks and repeat shares never grow rows — and,
      more importantly, never re-bill Duffel/seats.aero.
- [ ] `HOP_ENABLE_SHARE_RECEIPTS` off (default) → no share button renders, the action answers
      `{ok:false, reason:'disabled'}`, `/v/*` and its OG image 404. Byte-for-byte no-op deploy.
- [ ] Day-one spread measurement (graft): a `receiptsCreated` `WeeklyMetric` in
      `lib/business-digest.ts` (withDb count, null = degraded, same pattern as `ordersCreated`),
      plus the `ref=receipt` tag on the CTA URL so inbound is countable server-side later. The
      cold-start risk the winner named is now measured, not just acknowledged.
- [ ] Branded not-found (graft): `app/v/[id]/not-found.tsx` — `This link has hopped away.` + a
      Search-flights CTA. This is the region's one warm bunny moment.
- [ ] `npm run check` green; new pure logic unit-tested.
- **Non-goals (deliberate):** no valuations index yet (§ angle table); no wallet/balance sharing
  of any kind; no receipt-management UI (`revoked` column ships, no UI); no sitemap entry or
  indexing for `/v/*` (noindex — social spread, not SEO; thin-content risk); no embeds/iframes;
  no download-image button (the OG route *is* the image URL); no MCP tool for sharing; no
  changes to `/search` metadata or to the engine itself; no analytics sink for `ref=receipt`
  (the param is free — counting waits for a sink to exist).

## 2. Files to touch

| Path | Change | New? |
|---|---|---|
| `lib/env.ts` | Add `isShareReceiptsEnabled()` — flag-only gate (`HOP_ENABLE_SHARE_RECEIPTS`, `/^(1|true|yes)$/i`), no key requirement (deterministic seam, same rationale as `isObservedOutcomesEnabled()`, lib/env.ts:170) | no |
| `lib/shared-verdicts.ts` | The seam, engine-side: `VerdictSnapshot` type (structurally balance-/action-free); `validateShareParams(raw): SearchParams \| null` (strict — rejects, never default-fills); `buildVerdictSnapshot(result: SearchResult): VerdictSnapshot \| null` (pure projection, strict degraded gate); `newReceiptId()` (12-char base32 from `crypto.randomBytes`, ~60 bits, `/^[a-z2-7]{12}$/`); `verdictContentHash(params, dayISO): string`; `rowToSnapshot(row): VerdictSnapshot \| null` (read-side validation); `createSharedVerdict(...)` / `getSharedVerdict(id)` via `withDb`; the gate/rate-limit orchestration extracted here so it's node-testable | **yes** |
| `lib/rate-limit.ts` | Add `clientIpFromHeaders(h: Headers): string` (same header logic as `clientIp(request)`, which delegates to it) — server actions receive no `Request`, so the action reads `headers()` from `next/headers` and passes it in. This repairs the winner's hand-waved "request-IP-derived key" | no |
| `drizzle/0006_shared_verdicts.sql` | `hop_shared_verdicts` DDL (below), `IF NOT EXISTS` style of `0005_subscriptions.sql`; RLS enabled, **no anon policies**; `created_by` index for abuse forensics | **yes** |
| `lib/db/schema.ts` | `sharedVerdicts` pgTable mirroring the DDL | no |
| `utils/supabase/admin.ts` | Typed `Row`/`Insert`/`Update` for `hop_shared_verdicts` (the `hop_valuation_overrides` precedent at admin.ts:428 — without this, `.from('hop_shared_verdicts')` fails strict typecheck). Migration + schema + admin typed row + `withDb` module = the four-artifact table pattern; all four are in this table | no |
| `app/actions/share-verdict.ts` | `'use server'` action (pattern: `app/actions/checkout.ts`): gate → `checkRateLimit` (key: Auth0 sub when signed in, else `clientIpFromHeaders(await headers())`; `{capacity: 5, refillPerSec: 0.05}`) → `validateShareParams` → `assembleSearch(params, undefined, undefined)` → `buildVerdictSnapshot` → `createSharedVerdict` → `{ok:true, url}` \| `{ok:false, reason}` | **yes** |
| `components/ShareVerdict.tsx` | Client button: idle → pending → `Link copied` / error states; `navigator.share` when available, clipboard fallback; not rendered at all when flag off (server passes the gate down) | **yes** |
| `components/VerdictRail.tsx` | Mount `<ShareVerdict params={…}>` beside the existing secondary CTA when `isShareReceiptsEnabled()` and the result is shareable (clean verdict, no degradation) | no |
| `app/v/[id]/page.tsx` | RSC receipt page: `getSharedVerdict` → render or `notFound()`; `robots: { index: false }`; `pageMeta`-shaped metadata (`lib/seo.ts:45`) with the route in the title so unfurls read well | **yes** |
| `app/v/[id]/opengraph-image.tsx` | OG card from the same snapshot via `lib/og.tsx` primitives (`OG`, `Brand`, `Dot`, `ogFonts`, `tierColor`, `FONT_DISPLAY`, `FONT_BODY`); missing/revoked/invalid row → plain cream fallback (the sweet-spots OG pattern) | **yes** |
| `app/v/[id]/not-found.tsx` | Branded empty state: `This link has hopped away.` + Search flights CTA (the region's bunny moment) | **yes** |
| `lib/business-digest.ts` | Add `'hop_shared_verdicts'` to `CountedTable` (lib/business-digest.ts:83) + a `receiptsCreated: WeeklyMetric \| null` field computed via the existing `weeklyMetric` helper + a digest section rendering it | no |
| `lib/__tests__/shared-verdicts.test.ts` | Unit tests (§7) | **yes** |
| `lib/__tests__/business-digest.test.ts` | Extend for the new metric (null-degrade + render) | no |
| `docs/solutions/` (post-ship) | Entry: "snapshot-at-share-time for social cards — never recompute economics at crawl time" | **yes** |

No `eve/*` changes. No `middleware.ts` change (`/v/*` is public; the Supabase-refresh matcher
covers it harmlessly). **No `app/robots.ts` change — deliberately.** Noindex is per-page metadata
only; adding a `robots.txt` disallow for `/v/` would *prevent* crawlers from fetching the page,
so the noindex directive would never be seen and bare URLs posted on reddit could still be
reference-indexed. Two of the three drafts got this wrong; do not "re-fix" it in review.

DDL sketch (documented in the migration + module header; code never runs DDL):

```sql
CREATE TABLE IF NOT EXISTS "hop_shared_verdicts" (
  "id" text PRIMARY KEY,                  -- 12-char base32 slug, generated in code
  "content_hash" text NOT NULL UNIQUE,    -- hash(canonical params + UTC day): idempotency key
  "created_by" text,                      -- Auth0 sub or NULL (signed-out share); never rendered
  "params" jsonb NOT NULL,
  "snapshot" jsonb NOT NULL,              -- the engine-computed numbers, validated on read
  "revoked" boolean NOT NULL DEFAULT false,
  "created_at" timestamptz DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "hop_shared_verdicts_created_by_idx"
  ON "hop_shared_verdicts" ("created_by");  -- abuse forensics: "list everything this sub minted"
--> statement-breakpoint
ALTER TABLE "hop_shared_verdicts" ENABLE ROW LEVEL SECURITY;  -- no anon policies; service-role only
```

## 3. Engine hooks

- **`lib/search.ts:46#assembleSearch(params, undefined, undefined)`** — the single funnel
  (verified 3-arg signature: `params, userBalances?, prefs?`), called once per share action with
  **no balances and no prefs**: returns `SearchResult { options, pick, cashOption, verdict,
  summary{cheapestCash,bestMiles,bestCpp,saveVsCash}, degraded[] }` (`lib/types.ts:164`). Every
  number on every receipt comes from this call. Side benefit: the run flows through
  `recordCppObservations` (`lib/search.ts:220`, no-op until `isValuationSyncEnabled()`), so
  shares feed the Phase 2 valuations index for free.
- **Why not `verdictSummary`** (`lib/search.ts:376`): its trim keeps `youHave` (line 398) and
  per-option `action` (line 410) — exactly the fields a public artifact must not carry.
  `buildVerdictSnapshot` is therefore a **new type projected off raw `SearchResult`**, never a
  reuse of `VerdictSummary`; a unit test pins this (§7).
- **`lib/cpp.ts:19#formatValue`** — renders `¢/pt` strings; the snapshot carries `pick.cpp` and
  `pick.tier` exactly as the engine computed them (`cpp = (cash − taxes) × 100 / miles`; tiers
  ≥3.0/≥1.5; `POINTS_THRESHOLD_CPP = 2.5` decided the verdict upstream). The receipt **never
  re-derives** economics — it displays stored engine output.
- **`lib/airports.ts:60#cityForCode`** — route labels on page + card.
- **New `lib/shared-verdicts.ts#buildVerdictSnapshot`** — a pure *projection*, not a computation:
  copies `verdict`, `summary`, and the display fields of `pick`/`cashOption` (program, programId,
  airline, cabin, miles, taxes, cpp, tier, cash price) plus an `asOf` ISO timestamp. Returns
  `null` when the result isn't receipt-grade: **any non-empty `degraded[]`**, `verdict ===
  'none'`, `use-points` without a `pick`, or missing `summary.cheapestCash`. It computes nothing.
  Payload stays slim (pick + cash option display fields + summary + asOf — not all ranked
  options): smaller rows, smaller leak surface, and nothing on the rendered receipt needs more.
- **LLM involvement: none.** No LLM anywhere in this seam — the receipt is the "every number
  computed, never generated" invariant made into the shareable artifact itself (ADR 0002).

## 4. Flags & seams

- **Gate:** `isShareReceiptsEnabled()` in `lib/env.ts` — explicit flag only, read lazily at call
  time. Off (default): `VerdictRail` never renders the button (no client JS shipped for it),
  `shareVerdict()` returns `{ok:false, reason:'disabled'}` before touching anything, `/v/[id]`
  and its OG image call `notFound()` before the DB read. The deploy is inert until the owner
  flips the flag *and* runs the migration.
- **Why flag-only:** the seam needs no external key (Supabase is already configured; even
  without it, `withDb` degrades). The flag exists as (a) the house rule for new seams and (b) an
  **emergency brake**: if receipts are ever abused, one env flip kills creation *and* serving.
  Documented consequence: flipping off 404s already-shared links — deliberate; it's a brake, not
  a toggle to ride (see §8 risks for the `serving-only` upgrade path).
- **Ops runbook (happy path, mechanical):** run `drizzle/0006` → deploy → flip
  `HOP_ENABLE_SHARE_RECEIPTS`. Any other order is still *safe* — every query is `withDb`-wrapped,
  so a missing table means create → `{ok:false,'unavailable'}` and read → `null` → 404, never a
  throw — but the runbook order avoids serving 404s to the first sharers.
- **No new env keys.** `process.env` is never read directly (lazy accessor pattern preserved).
- **Framework ground truth (read, not recalled):**
  `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/01-metadata/opengraph-image.md`
  — `params` is a **Promise** in the image function's props; `ImageResponse` from `next/og`;
  dynamic OG routes are supported without `generateStaticParams`. And
  `node_modules/next/dist/docs/01-app/02-guides/caching-without-cache-components.md` —
  `cacheComponents` is **not** enabled in `next.config.ts` (verified: `experimental` holds only
  `viewTransition` + `optimizePackageImports`), so under the default caching model `/v/[id]` and
  its OG route are **dynamic by default** (uncached DB read per request — correct here; reads are
  one indexed row). Both existing param'd OG routes are static via `generateStaticParams` +
  `dynamicParams = false`; this is the repo's **first dynamic OG route**, hence the
  fonts-in-function verify step (F12). Server-action shape follows the in-repo Next 16 precedent
  `app/actions/checkout.ts` (`'use server'`, `ApiResult`-style returns, gate re-checked
  server-side, never trust the client).

## 5. Degradation plan — the failure catalog (the design *is* this table)

| # | What breaks | How it degrades |
|---|---|---|
| F1 | **Hostile client forges numbers** (the brand-killing failure: fake "$5,000 saved" cards) | Structurally impossible: the action's input is trip params only; `validateShareParams` strict-rejects anything malformed (`{ok:false,'invalid'}` — it never default-fills like `app/search/page.tsx:62#parseParams`, so a receipt can't silently be for SFO→LAX when the client sent garbage); all numbers come from the server-side `assembleSearch` run |
| F2 | **Balance/identity/prefs leak in a public artifact** | Structural: the engine run passes `undefined` balances and `undefined` prefs; `VerdictSnapshot` has no field that could hold them — nor `youHave`, `action`, or `bookingUrl` (the fields `VerdictSummary` carries, lib/search.ts:398/410); tests assert those **keys are absent**, not merely undefined, plus a `JSON.stringify` scan for fixture balance markers. `created_by` is stored, never selected into any render path. Receipts are public-by-design and safe-by-construction |
| F3 | **OG crawl recomputes the search** (cost: every unfurl = Duffel + seats.aero calls; trust: card ≠ page) | Snapshot-at-share-time. Page and OG image read the same stored row; **zero upstream calls after the share click**. The card can never disagree with the page |
| F4 | **Upstream degraded at share time** (any non-empty `degraded[]`, or verdict `none`) | Strict gate: `buildVerdictSnapshot` → `null` → action `{ok:false,'degraded'}` → button copy: `Not enough live data for a receipt. Try again in a minute.` No receipt is ever minted from partial math — including the superficially-tempting pay-cash-while-awards-dark case, where the *verdict itself* might be wrong. Consequence: receipts never need a `DegradedNote` |
| F5 | **DB unconfigured / table missing / query error** | `createSharedVerdict` → `withDb(fallback {ok:false,'unavailable'})`; `getSharedVerdict` → `withDb(null)` → `notFound()`; OG image → cream fallback card. Nothing throws |
| F6 | **Spam / unbounded row growth** (signed-out creation is allowed) | Three layers: `checkRateLimit(key, {capacity:5, refillPerSec:0.05})` (`lib/rate-limit.ts:136` — Upstash-durable when configured, in-memory fallback otherwise), keyed by Auth0 sub when signed in, else `clientIpFromHeaders(await headers())` (server actions get no `Request`; `next/headers` is the mechanically correct source) → `{ok:false,'rate-limited'}`; content-hash idempotent upsert (same trip + same UTC day → same row, unique index; on conflict, re-select and return the existing id — also the concurrent-double-click race resolution, and the reason repeat shares never re-bill upstream *rows*; the engine re-run still happens but the row set stays bounded); the flag as kill switch |
| F7 | **Receipt-id enumeration** | 12-char base32 id from `crypto.randomBytes` (~60 bits), shape `/^[a-z2-7]{12}$/` — and the payload contains nothing sensitive even if enumerated |
| F8 | **Stale numbers mislead a stranger a month later** | Mandatory `Priced Jul 2, 2026` on page *and* card, plus the fares-move caveat (§7 copy). `asOf` lives in the snapshot, not derived at render |
| F9 | **Malformed/legacy snapshot JSON on read** | `rowToSnapshot` validation (the `lib/valuation-overrides.ts:46#rowToOverride` pattern): every required field type-checked, numbers `Number.isFinite`-checked; invalid → `null` → `notFound()`. A bad row can never render `NaN¢/pt` on a shared card |
| F10 | **`revoked` rows** | Treated as missing everywhere (page, OG). No UI yet; the column is the cheap hook for takedown requests, with `created_by` + its index as the forensics path |
| F11 | **SEO thin-content damage from thousands of `/v/*` permalinks** | `robots: { index: false }` page metadata; excluded from sitemap and `STATIC_SEO_ROUTES` (`lib/seo-routes.ts:19`); **no** `robots.txt` disallow (a disallowed path is never fetched, so the noindex would never be seen). Revisit indexing in Phase 2 with real data |
| F12 | **Vendored fonts missing in the dynamic OG function bundle** | `lib/og.tsx:69#ogFonts` resolves via `import.meta.url` (Next traces the files) — but every existing OG route is statically prerendered and this one is dynamic, so this is a *verify-on-preview* item, not an assumption (§7) |

**user_id scoping:** the only new query paths are insert (with `created_by` set in code from the
session sub or null) and select-by-id. **The id-keyed public read is a deliberate, named
exception to the user_id-scoping rule** — flagged here for the security reviewer rather than
left to be discovered: it is justified because the payload is balance-free *by construction*
(F2), the id is unguessable (F7), and no per-user listing endpoint exists, so there is no
cross-user read path to scope. Service-role client, RLS enabled with no anon policies —
identical posture to every `hop_*` table.

**Irreversible acts / human gates:** none. No payments, no live keys, no bookings, no emails.
The only "publish" is the user's explicit share click — which *is* the consent gate the
constraints require. Owner-gated ops steps: run `drizzle/0006`, flip the flag, and the two
pre-launch checklist items in §8 (ToS skim, preview OG check).

## 6. Test plan

`lib/__tests__/shared-verdicts.test.ts` (node env, no keys needed — the module is
`withDb`-wrapped and the mapper is pure):

- **`buildVerdictSnapshot`**: use-points fixture with empty `degraded` → full snapshot (verdict,
  miles, cpp, tier, cash, saved, asOf); **any non-empty `degraded[]` → `null`** (including a
  pay-cash fixture with `degraded: ['awards']` — the strict gate); `verdict:'none'` → `null`;
  `use-points` with no `pick` → `null`; missing `summary.cheapestCash` → `null`.
- **Privacy, structural** (the load-bearing pair): a `SearchResult` carrying `balances` and
  options with `youHave`/`action`/`bookingUrl` projects to a snapshot where those **keys are
  absent** (`expect('youHave' in snap.pick).toBe(false)` framing, plus the same for `action` and
  `bookingUrl` on every projected object — not merely `undefined`), **and**
  `expect(JSON.stringify(snap)).not.toContain(...)` for fixture balance markers.
- **No re-derivation at boundaries**: fixtures at cpp exactly 2.5 / 3.0 / 1.5 keep the engine's
  verdict/tier untouched — including the input-verdict-`pay-cash`-at-bestCpp-2.5 case, which must
  project the cash headline (the mapper never re-decides against `POINTS_THRESHOLD_CPP`).
- **`validateShareParams`**: rejects missing `from`/`to`, `to === from`, non-IATA codes,
  malformed/past `depart`, `return < depart`, unknown cabin, adults > 9; accepts a clean
  round-trip and a one-way; **never default-fills** (garbage in → `null`, not SFO→LAX — the
  deliberate contrast with `parseParams`).
- **`newReceiptId`**: matches `/^[a-z2-7]{12}$/`; two calls differ.
- **`verdictContentHash`**: key-order independent; one-way ≠ round-trip; same trip different UTC
  day → different hash; stable across runs.
- **`createSharedVerdict` / `getSharedVerdict`**: with no DB configured → `{ok:false}` / `null`
  (exercises the `withDb` fallback exactly as `lib/__tests__` siblings do).
- **Gating/limits** (orchestration lives in `lib/shared-verdicts.ts` so it's node-testable):
  flag off → `'disabled'`; rate-limit exhaustion → `'rate-limited'` (use
  `_resetRateLimitForTest`, per `lib/__tests__/rate-limit.test.ts`).

`lib/__tests__/business-digest.test.ts` (extend): `receiptsCreated` metric — counted window,
null-degrade when the table is missing, rendered line present/absent accordingly.

Commands:
```bash
npx vitest run lib/__tests__/shared-verdicts.test.ts
npx vitest run lib/__tests__/business-digest.test.ts
npm run check          # lint + typecheck + all tests
npm run build          # catches RSC/route/OG-convention errors
# visual: seed one row locally (MOCK=1 share flow against a dev Supabase), then
npm run build && scripts/shoot.sh /v/<seeded-id>
# the OG image + fonts-in-function check (F12) happens on the Vercel preview —
# human eyeballs the unfurl in a real Slack/iMessage paste before the flag flips in prod
```

## 7. Copy & design notes (strict `docs/design/copy-spec.md` voice)

- Button: `Share this verdict` → pending `Building…` → success `Link copied` (with
  `navigator.share` sheet on mobile) → errors: `Not enough live data for a receipt. Try again in
  a minute.` / `Couldn't create the link. Try again.`
- Receipt kicker: `THE VERDICT` · headline two-liner, answer + number first: `Use points.` /
  `Save $412 vs cash.` (pay-cash: `Pay cash.` / `Points are only worth 0.9¢ here.`)
- Stat row (mirrors copy-spec §Verdict hero): `60,000 miles` · `2.9¢/pt` · `Cash $840` ·
  `You save $412` — tier color on the ¢/pt figure only, via tokens (AA-checked;
  `lib/og.tsx:28#tierColor` on the card).
- Provenance lines: `Aeroplan · SFO → NRT · Nov 3 – 17 · Business` and
  `Priced Jul 2, 2026 — computed from live cash fares and award space. Fares move.`
- Footer, two lines: `hop compares cash, miles, and transfer partners in one search.` and the
  factual agent-era line — `Every number computed, never generated — by the same engine any AI
  agent can call.` CTA: `Run this route yourself` → `/search?...&ref=receipt`. No "join
  thousands", no share-count vanity, no watermark spam — the artifact's restraint *is* the
  differentiation from growth-hack slop.
- Not-found page: `This link has hopped away.` + `Search flights` CTA — the region's one warm
  bunny moment; nowhere else does the bunny speak.
- Design: flat editorial per `docs/design/CHOSEN-editorial.html` — cream canvas, no
  shadows/gradients/glows; the receipt is a single paper card composed like the boarding-pass
  pick card; bunny = `Brand` mark in the OG corner and the page logo only. Motion: none beyond
  existing `.hop-rise`, reduced-motion-safe. Respect the primitives (Button `ink`/`secondary`
  tiers) from `docs/plans/2026-07-02-design-national-grade.md` — no improvised buttons.

## 8. Risks & open questions

- **Share-time re-run may differ from the on-screen result.** Two causes, both accepted and
  stated honestly: prices move in the minutes since render, and the receipt run is
  **balance-free and prefs-free** — verified: `applyPrefs` runs before the pick is read
  (`lib/search.ts:281`), so a prefs-carrying or signed-in sharer's screen can show a different
  pick/verdict than the stateless mint. The receipt is "the market math, timestamped", not "my
  personalized view" — which is also exactly what the `Run this route yourself` CTA reproduces
  for a stranger. The alternative (serialize the rendered result through the client) was
  **rejected**: it reopens F1. The other alternative (re-run with the sharer's balances+prefs,
  then trim) was **rejected**: it makes privacy procedural instead of structural and bakes
  prefs-dependent picks into a public artifact strangers can't reproduce.
- **Fonts in a dynamic OG function (F12)** — `import.meta.url` tracing should carry the vendored
  WOFF/OTF into the function bundle, but every existing OG route is static; verify on the first
  preview deploy before announcing anything.
- **Data-republication ToS (pre-launch owner checklist):** a receipt publicly republishes one
  cash fare + one award-space snapshot. Owner skims the Duffel and seats.aero terms for
  single-datapoint republication before the flag flips. Ten minutes; launch-relevant.
- **Cold-start virality**: receipts need sharers. Now measured (the `receiptsCreated` digest
  metric answers "is anyone sharing?" weekly); mitigation is operational — the owner seeds
  launch posts (r/awardtravel "here's the math" replies, HN/PH) using his own receipts. The
  artifact is deliberately the exact format those threads already improvise in text.
- **Idempotency cost (acknowledged trade):** the content-hash machinery (hash + UTC-day
  canonicalization + unique index + on-conflict re-select + tests) is the one piece of
  non-obvious mechanism in the slice. Kept deliberately: without it every double-click and
  repeat share mints a row and re-bills upstream searches; two of three judges kept it, and the
  dedupe-later alternative leaves the cost meter running from day one.
- **Emergency-brake semantics** (the flag, F6's third layer): flag-off 404s every shared link
  ever created. Acceptable for a brake; if receipts matter later, replace with a `serving-only`
  mode before ever using it casually.
- **Phase 2 dependency is ops, not code**: the valuations index needs `HOP_ENABLE_VALUATION_SYNC`
  flipped (the Worker deploys via CI — `.github/workflows/deploy-valuations-worker.yml`; the
  secrets step in `cloudflare/valuations-worker/README.md` is a human action). Until then Phase 2
  stays unbuilt — publishing under-sampled numbers is forbidden by ADR 0005 and by this plan.
- **Phase 2 pointers, recorded now so that plan starts warm:** (a) upgrade the footer
  `How we value points` link (`lib/seo-routes.ts`, currently `/support#how-hop-decides`) to
  `/valuations`, and add `/valuations` to `STATIC_SEO_ROUTES` + the sitemap; (b) reuse the
  inline-Dataset JSON-LD posture of `buildProgramJsonLd`
  (`app/sweet-spots/[program]/page.tsx:49`); (c) label rows `Measured` **only** where the live
  override `isLive` (≥20 fresh samples) — baseline rows stay visibly editorial; (d) publish the
  methodology page *with* the sample-bias disclosure — observed cpp is best-option-per-search, a
  ceiling-ish measure — or the first skeptical blogger dismantles the index.
- Open question for the owner: should signed-in sharers get a "my receipts" list + revoke UI in
  Phase 1.5, or wait for demand? (Column + `created_by` index exist; UI deferred at zero cost.)

## 9. Review hooks

- **engine-invariant-reviewer** — the core check: no number on `/v/*` or its OG card originates
  outside `assembleSearch`/the stored snapshot; the mapper projects, never computes (boundary
  fixtures at 2.5/3.0/1.5 untouched); no LLM anywhere in the seam.
- **degradation-reviewer** — F1–F12: `withDb` fallbacks, `{ok:false}` action results,
  `notFound()` paths, OG fallback card, strict degraded mint gate, rate-limit behavior, flag
  no-op byte-equivalence, digest metric null-degrade.
- **security-reviewer** — public permalink surface: strict param validation (no default-fill),
  no client-number trust, RLS/no-anon posture, `created_by` never rendered, id entropy/shape,
  rate-limit keying via `next/headers`, and the **named exception**: id-keyed public reads
  instead of user_id scoping, justified by the balance-free-by-construction payload.
- **nextjs16-reviewer** — dynamic route + `opengraph-image.tsx` conventions (Promise `params`),
  server-action shape, metadata/noindex composition via `pageMeta`, dynamic-by-default caching
  posture (no `cacheComponents`), and that nobody "re-fixes" the deliberate absence of a
  robots.txt disallow.
- **copy-voice-reviewer** — receipt + button + error + not-found strings against copy-spec
  (terse, number-first, no slop; bunny budget = the not-found page and the logo, nothing else).
- eve-architecture-reviewer — **skipped deliberately**: no `eve/*` surface is touched.

---

**Hand-off.** Approach in brief: pick one flagship artifact (verdict receipts) over doing all
four angles shallowly; make it forgery-proof and privacy-proof *by construction*
(server-recomputed, balance-free + prefs-free, snapshot-at-share-time, a snapshot type that
cannot hold personal fields); refuse to mint from any degraded result; gate everything behind
`HOP_ENABLE_SHARE_RECEIPTS` with `withDb` degradation and a mechanical
migration → deploy → flip runbook; measure spread from day one in the weekly digest; sequence
the live valuations index as Phase 2 fed by receipt-driven telemetry, and the wallet report card
as Phase 3 on the same spine. Next step: `/clear`, implement against this plan, then
`/review-parallel`, then `/compound` (capture snapshot-at-share-time as a `docs/solutions/`
entry).
