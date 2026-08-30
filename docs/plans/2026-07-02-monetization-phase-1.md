# 2026-07-02 — Turn hop into a profitable business (monetization Phase 1)

> Plan. Status: billing rail SHIPPED — Stripe-hosted checkout, signed webhook, and tier mapping are live behind `HOP_ENABLE_BILLING` (`app/api/billing/checkout/route.ts`, `app/api/webhooks/stripe/route.ts`, `lib/billing.ts`; ops: `docs/ops-runbook.md` §Billing). Remaining Phase-1 items stay as proposed below.
> TL;DR: hop already owns three monetization seams that earn $0 today because each is missing one wire — the Kiwi "affiliate" link carries no affiliate id, the card CTAs point at placeholder public pages with no click record, and `hop_subscriptions`/`ALERT_LIMITS` enforce a paywall nobody can pay through. Phase 1 attaches the missing wires (Kiwi tag, Stripe-backed premium at the roadmap's $9.99/mo · $99/yr, and — as an optional fast-follow — a card-click ledger) behind flags that no-op byte-for-byte when off; later phases monetize escalations, the MCP API, and hotels only after Phase 1 produces revenue data.

Lens commitment (risk-first): every section below starts from *what breaks* — Stripe down, webhook missed/replayed/out-of-order, DB unconfigured, signed-out caller, downgraded subscriber, hostile webhook forger — and shows the seam degrading instead of throwing.

---

## 1. Where the money is today (research findings — verified in code)

| Surface | State found | Revenue today |
|---|---|---|
| Kiwi cash CTA (`lib/booking.ts#cashBookingUrl:50`) | Builds `kiwi.com/en/search/results/...?adults=N` — **no `affilid` param at all**. "Affiliate" exists only in comments. | $0 |
| Card CTAs (`lib/card-affiliates.ts`, `components/VerdictRail.tsx:232`) | 15-card table, pure, tested; but `applyUrl`s are **public landing pages with a placeholder `?ref=hop-card`** (comment: "NOT real commission links"). No click instrumentation, so when the CJ partnership lands we'll have zero conversion baseline. | $0 |
| Subscription (`lib/subscription.ts`, `app/actions/standing-orders.ts:41`) | `getUserTier` + `ALERT_LIMITS {free:3, premium:∞}` already **enforced** in `alertCapBlock` on watch creation, with the upgrade copy "You're at the 3-alert limit on the free plan. Upgrade to add more alerts." — **but there is no billing path anywhere** (zero `stripe` code in repo; `hop_subscriptions` is typed in `utils/supabase/admin.ts:303` but absent from `lib/db/schema.ts`, and its DDL was "reported, NOT run" per the `lib/subscription.ts` comment). The cap message is a dead end — `components/WatchThisRoute.tsx` even has a dedicated `'limit'` status (line 21, detected via the `/alert limit/i` regex at line 55) that links to a `/account` page with nothing to buy. | $0 |
| Escalation (`lib/escalation.ts`, `app/api/concierge-escalation/route.ts`) | Phase-1 demand validation live: rate-limited lead capture → `hop_escalations` → owner email. No payment, per roadmap §6 design. Point.me benchmark: $200/pax. | $0 (leads) |
| Native Duffel checkout (`isCheckoutEnabled()`, `app/actions/checkout.ts`) | Flag-gated, **TEST key only** — structurally cannot earn money, by design (constraint: live key never touched). | $0 |
| MCP server + `hop_` tokens (`lib/api-tokens.ts`, `app/api/[transport]/route.ts`) | Free, unmetered; tokens hashed, `last_used_at` tracked. A natural pro/API tier later. | $0 |
| Stripe env | `STRIPE_SECRET_KEY` / publishable key already set in Vercel; `STRIPE_WEBHOOK_SECRET` presumably not (no webhook endpoint exists to have created one). | — |

**Prior art honored**: roadmap WS2 (card affiliates — built), WS3 (subscription — this plan is literally WS3's listed files, at WS3's stated price of **$9.99/mo or $99/yr**), WS6 (escalation Phase 1 — built; Phase 2 payment deferred here too), WS7 (hotels — roadmap says defer; this plan keeps that). One **deliberate, stated divergence from WS3**: its env table lists `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, but with Stripe-*hosted* Checkout there is no client-side Stripe.js, so the publishable key is unused and no `NEXT_PUBLIC_` Stripe key ships — server-side secret only, zero client bundle weight. `docs/plans/auth-db-migration.md` honored via the `stripe_customer_id` re-link note in §10. Eve plan untouched (no billing tools for Eve or MCP). Framework ground truth read: `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md` (Route Handlers; `await request.text()` gives the raw body needed for Stripe signature verification — no body-parser config in App Router).

## 2. Revenue streams ranked (effort × fit × expected value at pre-scale traffic)

| # | Stream | Effort | Fit with moat | EV at current traffic | Phase |
|---|---|---|---|---|---|
| 1 | Attach real Kiwi affiliate id to every cash CTA | Trivial (1 function) | Perfect — rides existing traffic | Low $/click but strictly > $0, zero ongoing cost | **1** |
| 2 | Stripe premium tier ($9.99/mo · $99/yr) unlocking unlimited alerts | Medium (client + 2 routes + migration + UI) | Perfect — paywall already enforced, PointsYeah proves $99/yr works | Highest near-term ceiling; converts the existing cap dead-end | **1** |
| 3 | Card-affiliate click ledger (redirect route) | Small | Perfect — data prerequisite for the $100–$400/approval CJ deal | $0 direct, unblocks the highest-$ stream | **1.5** (optional fast-follow) |
| 4 | Swap card `applyUrl`s to CJ network links | Small code / **external blocker** (partnership approval) | Perfect | High per-conversion | 2 |
| 5 | Paid escalation: $149 flat "hop books it" (Stripe Payment Link on owner-accepted leads, human-fulfilled) | Small code, real ops cost | Strong (Point.me $200/pax) | Depends on lead volume `hop_escalations` is measuring right now | 2 |
| 6 | Generalized outbound-click beacons (cash/award CTAs via `sendBeacon`) | Medium (client component + endpoint + table) | Analytics, not revenue | Negligible at this traffic | 2 |
| 7 | MCP/API metering: free tier N calls/day per `hop_` token, premium unmetered | Medium | Strong — verdict-quality API is unique | Low until MCP distribution grows | 3 |
| 8 | SEO sweet-spot pages (roadmap WS5) — traffic multiplier for 1–4 | Medium | Strong | Indirect | 3 |
| 9 | Hotel/Expedia affiliate + Tripsy hand-off | Very high (roadmap WS7: defer) | Dilutes the flight verdict focus | Unknown | 4 |
| 10 | Native checkout markup on live Duffel | — | **Rejected for now**: violates the live-key constraint; would need its own ADR + managed-payments decision | — | not planned |

## 3. Requirements (Phase 1 — done means)

- [ ] `cashBookingUrl` carries `affilid=<KIWI_AFFILIATE_ID>` when the env key is set; **byte-identical output when unset** (existing snapshot tests must not need weakening — they pass because tests run keyless).
- [ ] A signed-in free user at the cap can click "Upgrade" (from `/account#billing` **or** the `WatchThisRoute` limit state, which links there), pay on Stripe-hosted Checkout (the human gate), return to `/account?upgraded=1`, and create a 4th alert once the webhook lands. Tier changes flow **only** through the webhook, never from the redirect success URL (redirects are forgeable).
- [ ] Downgrades cannot be missed: Checkout Sessions set `subscription_data.metadata.user_id`, so `customer.subscription.updated`/`deleted` events carry our ref; when metadata is absent anyway, attribution falls back to a `userIdForStripeCustomer(customerId)` lookup over the stored `stripe_customer_id`. No attacker-controlled `user_id` ever reaches the upsert.
- [ ] `isBillingEnabled()` off (default) → `/account` shows no billing section, the checkout route answers `{ok:false}`/503, webhook answers 503, cap copy unchanged. The deploy is a no-op even with Stripe keys present in Vercel.
- [ ] Subscription lapse/cancel → tier reverts to `free`; existing >3 active watches are **not** auto-deactivated (deactivation is a user-visible destructive act; the cap only gates *new* creates, matching today's `alertCapBlock` semantics — documented, deliberate).
- [ ] Every number in upgrade copy is engine-computed: active-alert count from `countActiveStandingOrders`, cap interpolated from `ALERT_LIMITS[tier]` (never a hardcoded "3"). The price is configuration (a constant paired to the Stripe Price — see §10 drift risk), not economics; no LLM touches any of it.
- [ ] Any revised cap message keeps the literal substring "alert limit" **or** updates the `/alert limit/i` regex at `components/WatchThisRoute.tsx:55` in the same change (the limit-state UI is detected by that regex — invisible coupling made visible here).
- [ ] Optional fast-follow (Phase 1.5, same shape, deferrable without breaking the money path): card CTA clicks route through `/r/card/[program]` (best-effort ledger row, **always 302s** even when the DB write fails; unknown program → 302 `/`, never 500), and a Stripe customer-portal route for self-serve cancel/card management.
- Non-goals: no CJ links yet (blocked on partnership), no paid escalation yet (demand data still accruing), no MCP metering, no Duffel changes of any kind, no trial logic, no proration/seat logic, no coupon UI, no outbound-click beacon subsystem (Phase 2 at the earliest).

## 4. Files to touch (Phase 1; rows marked *(1.5)* are the optional fast-follow)

| Path | Change | New? |
|---|---|---|
| `lib/env.ts` | Add `EnvKey`s: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID_PRO_MONTHLY`, `STRIPE_PRICE_ID_PRO_YEARLY` (yearly optional — monthly alone validates the rail), `KIWI_AFFILIATE_ID`; accessors for each; new gate `isBillingEnabled()` = `HOP_ENABLE_BILLING` truthy **and** `hasEnv('STRIPE_SECRET_KEY')` **and** `hasEnv('STRIPE_WEBHOOK_SECRET')` **and** `hasEnv('STRIPE_PRICE_ID_PRO_MONTHLY')`. No `NEXT_PUBLIC_` key (see §1 divergence note) | no |
| `lib/booking.ts` | `cashBookingUrl`: append `&affilid=…` iff `hasEnv('KIWI_AFFILIATE_ID')` (lazy, call-time read) | no |
| `lib/stripe.ts` | Stripe I/O seam: dynamic `import('stripe')` inside functions (missing key path never loads the SDK — the `lib/email.ts`/resend pattern). `createCheckoutSession({userId,email,interval}) → {ok:true,url} \| {ok:false,reason}` — sets `client_reference_id`, `metadata.user_id`, **and `subscription_data.metadata.user_id`** (so lifecycle events carry the ref); `createPortalSession(customerId)` *(1.5)*; `verifyStripeEvent(rawBody,sig) → {ok:true,event} \| {ok:false,reason:'unconfigured'\|'bad-signature'}` via the SDK's `webhooks.constructEventAsync` (no hand-rolled HMAC). Never throws | **yes** |
| `lib/billing.ts` | **Pure, I/O-free** event mapper: `tierFromStripeEvent(event) → {userId, tier, customerId?, subscriptionId?, eventAt} \| null` — extracts `metadata.user_id`/`client_reference_id`, maps `checkout.session.completed`→`premium`, `customer.subscription.updated`→status-derived tier, `deleted`→`free`; unknown event types → `null`. Unit-testable with plain fixture objects, no mocks | **yes** |
| `lib/subscription.ts` | Add `setUserTier(userId, tier, meta:{customerId?,subscriptionId?,eventAt}) → boolean` (upsert via `withDb(false, …)`, skips writes whose `eventAt` predates the stored `last_event_at` — out-of-order webhook guard); `userIdForStripeCustomer(customerId) → string \| null` (fallback attribution for lifecycle events lacking our metadata); `getSubscriptionMeta(userId)` for the portal link *(1.5)* | no |
| `lib/db/schema.ts` | Add `subscriptions` (`hop_subscriptions`: `user_id` text pk, `tier`, `stripe_customer_id` (indexed), `stripe_subscription_id`, `last_event_at`, `updated_at`) and *(1.5)* `affiliateClicks` (`hop_affiliate_clicks`: `id` uuid pk, `user_id` text null, `kind` text, `target` text, `created_at`). Note: `hop_subscriptions` is **not currently in this file** — this authors the full table definition, not a column add | no |
| `drizzle/0005_subscriptions.sql` | `CREATE TABLE IF NOT EXISTS hop_subscriptions` + `ALTER TABLE … ADD COLUMN IF NOT EXISTS` for the Stripe columns (IF NOT EXISTS everywhere because the table may already exist in prod from the earlier hand-run SQL — verify live schema first), index on `stripe_customer_id`, RLS enabled, no anon policies (service-role, scoped in code). *(1.5)* `hop_affiliate_clicks` same treatment | **yes** |
| `utils/supabase/admin.ts` | Extend the `hop_subscriptions` Row/Insert/Update types (line 303) with `stripe_customer_id`, `stripe_subscription_id`, `last_event_at`; *(1.5)* add `hop_affiliate_clicks` types. Without this the mechanical implementer hits a type error | no |
| `app/api/billing/checkout/route.ts` | POST; Better Auth session required (via the `lib/auth0.ts` compat shim; 401 `{ok:false}` otherwise); rate-limited (`checkRateLimit`, sub+IP keys, mirroring the escalation route); gate `isBillingEnabled()` → 503 `{ok:false}`; calls `createCheckoutSession`; returns `{ok:true,url}` (client navigates — Stripe-hosted page is the human money-gate) | **yes** |
| `app/api/billing/portal/route.ts` *(1.5)* | POST; same gates; `{ok:true,url}` to Stripe customer portal (cancel/card management lives on Stripe, not in our UI — nothing irreversible implemented by us). Until this ships, "Manage billing" copy points at Stripe's no-code customer portal login link or is omitted | **yes** |
| `app/api/webhooks/stripe/route.ts` | POST; `export const runtime = 'nodejs'` (matches the escalation route; avoids edge raw-body/crypto surprises); `const raw = await request.text()` then `verifyStripeEvent(raw, request.headers.get('stripe-signature'))`; bad signature → 400; unconfigured → 503; then **verify → map (`tierFromStripeEvent`) → attribute (metadata, else `userIdForStripeCustomer`) → `setUserTier`**. Events that map to `null` or attribute to nobody → 200-ack, no write (so Stripe stops retrying); a **failed tier write → 500** so Stripe retries (the one deliberate non-200: retry is the recovery mechanism); handler idempotent (pure upsert + `last_event_at` guard) | **yes** |
| `middleware.ts` | Add `api/webhooks` to the matcher exclusion (same rationale as the MCP transports: cookie-less server-to-server POST; session refresh there is pointless and could mutate cookies on Stripe's client) | no |
| `app/r/card/[program]/route.ts` *(1.5)* | GET; `cardForProgram(param)` (canonical id via `canonicalizeProgram`) → best-effort `withDb` insert into `hop_affiliate_clicks` (`user_id` from optional session, null OK) → 302 to `applyUrl`; unknown program → 302 `/`; DB down → still 302 (redirect first-class, ledger best-effort). Targets come only from the static table — no query-param passthrough, no open redirect | **yes** |
| `components/CardAffiliateCTA.tsx` *(1.5)* | href → `/r/card/<canonical id>` | no |
| `components/BillingSection.tsx` | `/account` section with `id="billing"` anchor: tier line ("Free — {active} of {ALERT_LIMITS.free} alerts used" / "Premium — unlimited alerts"), Upgrade → POST checkout, Manage → portal *(1.5)*. `/account?upgraded=1` renders one line: "You're on Premium." (display only — tier truth still comes from the webhook-written row). Renders `null` when `!isBillingEnabled()` | **yes** |
| `app/account/page.tsx` | Mount `<BillingSection/>` (server-fetched `getUserTier` + `countActiveStandingOrders` alongside the page's existing `Promise.all`) | no |
| `app/actions/standing-orders.ts` | `alertCapBlock` copy, interpolated from `ALERT_LIMITS[tier]`, gains the destination only when billing is on: "You're at the {limit}-alert limit on the free plan. Upgrade in Account to add more." — keeps the "alert limit" substring the `WatchThisRoute` regex matches | no |
| `components/WatchThisRoute.tsx` | Limit-state link (line ~102): `/account` → `/account#billing`; keep or update the `/alert limit/i` detection (line 55) in lockstep with the copy change | no |
| `package.json` | add `stripe` dependency | no |

## 5. Engine hooks

- `lib/subscription.ts#getUserTier(userId) → 'free'|'premium'` (existing; default `'free'` on every failure) — the single tier oracle; the webhook is its only writer besides manual SQL.
- `lib/standing-orders.ts#countActiveStandingOrders(userId) → number` — the alert count shown in billing copy.
- `lib/subscription.ts#ALERT_LIMITS[tier]` — the cap, interpolated into every copy string that mentions it.
- `lib/card-affiliates.ts#cardForProgram` / `formatBonus` — unchanged; still advertising, never feeding cpp/verdict.
- `lib/booking.ts#cashBookingUrl` — URL builder only; the affiliate id changes zero economics.
- `lib/billing.ts#tierFromStripeEvent` — pure mapping, no I/O; the webhook route is verify → map → write and nothing else.
- **Moat reassertion**: nothing in this plan touches `assembleSearch`, `lib/cpp.ts`, ranking, or the verdict. No LLM anywhere in the billing path — and **no MCP/concierge/Eve tool gets any billing capability**. Every number on the billing surface (alert count, cap) is computed by `lib/*`; the price is a Stripe-side constant, displayed verbatim, never derived.

## 6. Flags & seams

- **`HOP_ENABLE_BILLING`** (new, `isBillingEnabled()`): requires the flag **and** the Stripe secret, webhook secret, and monthly price id — exactly the `isCheckoutEnabled()` double-lock pattern. Off → no billing UI, all billing routes refuse softly, the deploy is inert even with keys present in Vercel.
- **`KIWI_AFFILIATE_ID`** (env presence *is* the gate — mirrors `RESEND_API_KEY`/`isEmailEnabled`): absent → today's URL, unchanged.
- Click-ledger route *(1.5)* needs no flag: it degrades to a plain redirect (the pre-existing behavior) whenever the DB/table is absent.
- All new keys go through `lib/env.ts` lazy accessors; no `NEXT_PUBLIC_` Stripe key at all (hosted Checkout — no client-side Stripe.js; deliberate, documented divergence from roadmap WS3's env list).
- **Live Duffel key**: untouched. `isCheckoutEnabled()` untouched. Stripe charges subscription fees only; it never books travel.

## 7. Degradation plan (the failure enumeration this lens exists for)

| Failure | Behavior |
|---|---|
| Stripe API down at upgrade click | `createCheckoutSession` catches → `{ok:false,reason:'stripe-error'}` → route 503 → button shows "Couldn't reach billing — try again in a minute." Account page still renders (tier read is independent). |
| Webhook never arrives (Stripe retries exhausted) | Tier stays `free` after payment — degrading *open* is wrong for money, so this is the one place we accept a support path: Stripe retries for ~3 days; the customer portal shows the sub; owner fixes via SQL. Lazy reconcile in `getUserTier` is a named Phase 2 item. |
| Webhook replayed / duplicated | Pure upsert — second write is a no-op. |
| Webhooks out of order (`updated` after `deleted`) | `last_event_at` guard in `setUserTier` drops stale events — premium cannot be resurrected by a late event. |
| Forged webhook | SDK signature check (400); even a valid-signature event without **our** `metadata.user_id` only attributes via our own `stripe_customer_id` lookup — no attacker-controlled `user_id` ever reaches the upsert; unattributable events are 200-acked and ignored. |
| Lifecycle event without metadata (subscription objects don't inherit session metadata by default) | Prevented at the source (`subscription_data.metadata.user_id` set at session creation) **and** backstopped by `userIdForStripeCustomer(customerId)` — downgrades cannot be silently dropped. |
| DB unconfigured / `hop_subscriptions` missing | `getUserTier` → `'free'` (existing contract); `setUserTier` → `false` → webhook returns **500 so Stripe retries** — the one deliberate non-200, because retry is the recovery mechanism for a transient DB blip on a money-truth write. |
| Subscriber downgrades with 6 active watches | Watches keep running; only *new* creates hit `alertCapBlock` (existing semantics — nothing auto-deactivated, nothing irreversible). |
| `/r/card` insert fails *(1.5)* | Redirect happens regardless; a lost click row costs analytics, not UX. |
| Signed-out user posts to billing routes | 401 `{ok:false}`; webhook route deliberately unauthenticated-but-signed; rate limiting (sub+IP) on checkout/portal blunts scripted session creation (each Checkout Session is otherwise a free Stripe API call for an attacker). |
| **user_id scoping** | `hop_subscriptions` keyed by the Better Auth user id (`sub` via the `lib/auth0.ts` compat shim), written only from webhook metadata **we** minted or our own customer-id lookup; `hop_affiliate_clicks.user_id` nullable, read only by future owner-gated admin (like `listRecentEscalations`); both tables RLS-on, no anon policy (service-role, scoped in code). |

## 8. Test plan

New: `lib/__tests__/stripe.test.ts`, `lib/__tests__/billing.test.ts`; extend `lib/__tests__/email-subscription.test.ts`, `lib/booking.test.ts`; `app/api/webhooks/stripe/route.test.ts` (node env — allowed by vitest config's `app/**/*.test.ts`).

- `cashBookingUrl`: without `KIWI_AFFILIATE_ID` → exact current URL (regression); with it (stub `process.env` per-test) → single `affilid` param, no double-`?`.
- `lib/stripe.ts` keyless: every function resolves `{ok:false,reason:'unconfigured'}`, never throws, never imports the SDK (spy on dynamic import).
- `verifyStripeEvent` with garbage sig + real-looking secret → `{ok:false,reason:'bad-signature'}`.
- `tierFromStripeEvent` (pure — plain fixtures, zero mocks): `checkout.session.completed` with metadata → `{tier:'premium'}`; `subscription.deleted` → `'free'`; event without any user ref → `null`… ref carried via `subscription_data` metadata → attributed; unknown type → `null`.
- `setUserTier`: unconfigured DB → `false`; `normalizeTier` junk → `'free'`; stale `eventAt` skipped (mock `withDb`). `userIdForStripeCustomer`: no row → `null`.
- Webhook route: bad JSON→400, missing sig→400, unconfigured→503, unattributable event → 200 + no write, failed write → 500.
- Cap boundary (existing `atCap` tests): re-run; add "premium user creates 4th watch → no block"; assert cap copy still matches `/alert limit/i`.
- `/r/card` *(1.5)*: unknown program → 302 `/`; known → 302 to `applyUrl` with DB mocked dead.
- Commands: `npx vitest run lib/__tests__/stripe.test.ts lib/__tests__/billing.test.ts lib/booking.test.ts lib/__tests__/email-subscription.test.ts`, then `npm test`, `npm run lint`, `npx tsc --noEmit`, `npm run build`.

## 9. Copy & design notes (`docs/design/copy-spec.md` voice)

- Billing section, flat editorial, hairline border like `WatchThisRoute` — no shadows/gradients. Heading "Plan". Free: "Free — 2 of 3 alerts used." (both numbers interpolated: `countActiveStandingOrders` / `ALERT_LIMITS.free`). Premium: "Premium — unlimited alerts." Button: "Upgrade — $9.99/mo" (state the number, no "unlock your potential" slop). Manage: "Manage billing". Failure: "Couldn't reach billing — try again in a minute." Post-checkout (`?upgraded=1`): "You're on Premium."
- Cap message (server action) stays terse and keeps the load-bearing substring: "You're at the {limit}-alert limit on the free plan. Upgrade in Account to add more."
- Don't oversell: unlimited watches alone is a thin pitch pre-Eve — Phase 1's job is the rail + measurement, Eve's proactive delivery is the retention payload. Copy states what premium does today, nothing more.
- No bunny on billing (money surface ≠ warm-moment region). No emoji.

## 10. Risks & open questions

- **Table drift**: `hop_subscriptions` may already exist in prod (hand-run SQL, "reported, NOT run") — migration is `CREATE TABLE IF NOT EXISTS` + `ALTER … ADD COLUMN IF NOT EXISTS` for the Stripe columns. Verify against live schema before running.
- **Deploy order**: code (inert) → create Product/Price(s) in Stripe → register webhook endpoint → set `STRIPE_WEBHOOK_SECRET` + `STRIPE_PRICE_ID_PRO_MONTHLY` (+ yearly if offered) → flip `HOP_ENABLE_BILLING`.
- **Price**: $9.99/mo · $99/yr **matches roadmap WS3 exactly** — no silent deviation. Open question: launch monthly-only (one Price, one button, faster dashboard setup) vs both; the yearly env key is optional so either works. PointsYeah's $99/yr is the benchmark either way.
- **Price drift**: the label `BillingSection` renders is a code constant that must mirror the Stripe Price object; Phase 2 should read the Price via API instead of trusting the constant. Record the pairing when creating the Price.
- **Auth migration compatibility** (`docs/plans/auth-db-migration.md`): when `user_id` semantics change at the Better Auth cutover, **`stripe_customer_id` is the stable re-link key** — another reason it's a first-class indexed column, not an afterthought.
- **Missed-webhook reconciliation** deliberately deferred (see §7) — capture as a `docs/solutions/` follow-up if it bites.
- **Kiwi affiliate id** requires a Kiwi/Tequila affiliate account; confirm the param name (`affilid`) against the live affiliate dashboard before setting the env var — code takes the value blind, so a wrong guess costs nothing while unset.
- Irreversible-actions audit: the only money movement is a user-clicked Stripe-hosted Checkout (human-gated by construction); cancellation lives in Stripe's portal; hop never charges programmatically; no MCP/concierge/Eve tool gets any billing capability.
- Doesn't contradict the roadmap (implements WS3 at its stated price, defers WS6-payment/WS7 exactly as written; the publishable-key omission is stated in §1) or the Eve plan.
- **Compound step** (`/compound` after implementation): capture the webhook nuances as a `docs/solutions/` entry — subscription-metadata inheritance (why `subscription_data.metadata` is set at session creation), the deliberate 500-for-retry exception to the never-throw house style, and the `WatchThisRoute` regex↔copy coupling.

## 11. Review hooks

- **security-reviewer** — webhook signature path, metadata/customer-id-only attribution, rate limits, RLS-off-by-code scoping, open-redirect check on `/r/card` (targets only from the static table — assert no query-param passthrough).
- **degradation-reviewer** — every `{ok:false}` path above, the deliberate webhook-500-for-retry exception, `withDb` fallbacks.
- **engine-invariant-reviewer** — confirm zero contact with cpp/verdict code; billing numbers interpolated from `ALERT_LIMITS`/`countActiveStandingOrders`, never hardcoded or narrated.
- **copy-voice-reviewer** — billing section + cap message + upgraded-return line.
- **nextjs16-reviewer** — raw-body handling and `runtime = 'nodejs'` on the webhook route, middleware matcher change, route conventions.

**Phase map**: **Phase 1** (this session, mechanical, minimal money lane) = env → `lib/stripe.ts` seam → `lib/billing.ts` mapper → `setUserTier` + migration + admin types → checkout route → webhook route → `BillingSection`/`WatchThisRoute`/cap copy → Kiwi param. **Phase 1.5** (fast-follow, deferrable) = customer-portal route + `/r/card` click ledger (kept exactly this scope — redirect-first, ledger best-effort, no client component; when CJ conversations open). **Phase 2** = CJ link swap (external) + $149 paid escalation via Stripe Payment Link on owner-accepted leads (`hop_escalations.status` gains `quoted|paid`) + outbound-click beacons + price-read-via-API + lazy webhook reconcile. **Phase 3** = MCP token metering + SEO sweet-spot pages. **Phase 4** = hotels (per roadmap, only after 1–3 monetize).
