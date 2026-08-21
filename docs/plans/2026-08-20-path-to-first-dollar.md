# 2026-08-20 — Path to first dollar (operating addendum)

> Plan. Status: **adopted operating addendum** (this PR). Does not replace the 2026-07-04
> business plan. TL;DR: hop's engine and monetization rails are built; verified revenue is
> still $0 because almost nobody has been asked to visit, and nobody has been asked to pay
> on a *licensed* product. The next experiment is distribution plus taking seats.aero **off**
> the paid path (founder 2026-08-21: won't-buy the commercial license — see
> `2026-08-21-replace-seatsaero.md` / ADR 0014). Not more features, and not a claim that the
> product is proven at 14 visitors/week. Near-term consumer readout: **one attributed dollar**
> (a Travelpayouts *commission* or a legitimate Stripe charge). Company-scale path, run in
> parallel, not after Floor: MCP listing + one B2B conversation. The expired "$10k MRR in
> 30 days" target is not a planning input.

**How this doc relates to the others.** `docs/plans/2026-07-04-business-plan.md` remains the
umbrella for positioning, pricing (`PRO_PRICE_YEARLY_USD = 49`), the five streams, and the
four §3.1 billing gates. **This file sequences the next 90 days.** The media engine
(`2026-07-05-media-engine-to-1m.md`) stays the ambition layer and does not jump this queue.
The agentic north-star (`2026-07-05-agentic-travel-agent-northstar.md`) stays the product
vision (P1–P5); its "$10k+ MRR within 30 days of 2026-07-05" target **expired on the
declared date 2026-08-05 at $0** and is historical.

**Glossary — do not mix these:**

| Term | Meaning today (2026-08-20) |
|---|---|
| **Billing flag ON** | `HOP_ENABLE_BILLING` + Stripe keys, as reported in `docs/ops-runbook.md` |
| **R0.2 unknown** | No in-repo Stripe/DB read has confirmed a live or test purchase |
| **Billing legitimate** | All four July 4 §3.1 gates. Gate ④ (amended 2026-08-21, ADR 0014): seats.aero is **not queried** on the commercial/paid search path. Chart-cpp at honest-copy parity is enough; a failover that keeps seats.aero primary is not. Unmet until FD-charts ships and the Production key/flag is off. A Pro charge on the unlicensed feed is evidence of the plan violating itself, not of a business |
| **July 4 B1–B4** | Pricing page, MCP quotas, unit-economics panel, ops runbook — largely *shipped* |
| **FD-copy / FD-charts / FD-live** | This addendum's agent idle work. Never called `B1`/`B2`. FD-fallback (failover) is retired |

---

## 1. Where the business actually stands (audited 2026-08-20)

Re-verified against current `main` (`aba8e7c`, 2026-08-07) plus a live production read today.
The July 4 audit at `6e30e51` is six weeks stale; several rails it called "one wire short"
are now wired. The money still is not.

### 1.1 Rails vs the July 4 table

| Rail | July 4 state | 2026-08-20 state | Evidence |
|---|---|---|---|
| Verdict engine | Strong; multi-pax P1 open | **R0.1 Passed (code).** Searches still resolve 1:1 into verdicts. **Unobserved on real multi-pax traffic** at this volume | Roadmap addendum; funnel-log `search_ran` = `verdict_viewed` on Regular days |
| Subscriptions (Stripe) | Built twice, works zero times | Rail shipped behind `isBillingEnabled()`. **R0.2 unknown** — ops-runbook previously disagreed with itself; this PR marks it Unknown rather than picking a side. Finance ledger has no Stripe/DB read across 8 runs | `lib/billing.ts`, `lib/stripe.ts`; `docs/ops-runbook.md`; `docs/finance/ledger.md` |
| Public pricing | `/account#billing` only | **July 4 B1 shipped.** `/pricing` + `lib/pricing.ts` (`PRO_PRICE_YEARLY_USD = 49`), FAQ/JSON-LD gated on `isBillingEnabled()` | `app/pricing/page.tsx` |
| MCP quotas | Free, unmetered | **July 4 B2 shipped.** `MCP_DAILY_LIMITS` free 25 / premium 1,000; durable count from `hop_mcp_usage` | `lib/subscription.ts`, `lib/mcp-usage.ts` |
| Unit-economics panel | Unbuilt | **July 4 B3 mostly shipped.** `computeMrr()` reads `hop_subscriptions` × Stripe price ids. `llmCostUsd` is an env override that returns `null` when unset | `lib/unit-economics.ts` |
| Ops runbook | Unbuilt | **July 4 B4 shipped**, then drifted; this PR reconciles the R0.2 clash to **Unknown** | `docs/ops-runbook.md` |
| Cash affiliate (Kiwi) | Travelpayouts JS tag only | **Wired.** `cashBookingUrl` wraps Kiwi in `tp.media` (marker 745576 / trs 545389 / p 4136) behind `/api/go/kiwi`. Pays on a **completed booking**, not a click | `lib/booking.ts`; `docs/solutions/2026-07-04-travelpayouts-attribution-through-first-party-redirect.md` |
| Card affiliate | Placeholder `applyUrl`s | **Unchanged.** `ref()` still appends `?ref=hop-card` (or `NEXT_PUBLIC_CJ_AFFILIATE_TAG`). No CJ/Impact network links | `lib/card-affiliates.ts:107-109` |
| Alerts | Cron dark, DKIM unverified | **Infra on** (cron + hop.flights DKIM/SPF). **Unobserved on real paying users** — the $99 raise clock has not started | ops-runbook current-state table |
| Observed cpp | Gated, inert | **Live.** Production `GET https://hop.flights/api/stats` on 2026-08-20 returned `{"verifiedPrograms":14,"totalPrograms":34,"degradation24h":{"cash":0,"awards":0}}`. `/stats` shows the count; signed-in `LiveValuationShelf` shows per-program cpp but labels `sampleSize` as "live bookings" (those are `assembleSearch` observations, not bookings) | live curl; `app/stats/page.tsx`; `components/landing/LiveValuationShelf.tsx:24` |
| Fallback award source | Named as R3.1 parallel work | **Zero code** as of 2026-08-20. **Re-specified 2026-08-21:** N-320 is **won't-buy**; N-386 is **replacement** (chart-cpp, then first-party live search), not silent failover. Plan: `2026-08-21-replace-seatsaero.md` | repo grep 2026-08-20; founder decision 2026-08-21 |
| MCP directory listing | Unbuilt | **PR #409 open** (Official MCP Registry via GitHub OIDC), ADR 0009 hold-for-owner. Gondola already holds `ai.gondola/gondola` on the same registry | GitHub PR #409; gondola.ai/mcp |
| Community launch | Not started | Three drafts in `docs/marketing/drafts/` unposted since 2026-07-06 / 2026-07-17. They still pitch a world this plan's §3 retires — rewrite before posting | draft files |

### 1.2 Demand (from the growth desk, not invented)

Last merged funnel-log entry: **2026-08-07** (13 days stale as of this writing). Last strategy
pull: 2026-08-09 (PR #412, still draft). Shape since instrumentation shipped 2026-07-05:

- **hop.flights traffic** is flat at roughly **10–14 visitors / week** (PostHog `$host =
  hop.flights`). The mid-July "rising visitors" read was a shared-project artifact; corrected
  2026-07-12.
- **Engine reliability at that volume is fine.** Regular `search_ran` equals `verdict_viewed`
  on every day that has volume.
- **Confirmed-`Regular` `signed_up` and `first_program_added`: zero** across every logged day
  since 2026-07-05 through 2026-08-07. Nonzero spikes on 7/18, 7/30, and 8/5 were 100%
  `$virt_traffic_type = Automation` and correctly discarded.
- **Confirmed-`Regular` `outclick`: zero since 2026-07-14** at the last merged read.

That sample is **too small to declare the product funnel proven or broken.** A 2%
visit→action rate at 14 visitors/week is ~0.3 events/week — long zero stretches are what
you expect. The 2026-07-10 funnel-log already hypothesized a CTA issue (sign-in ask only on
points-favorable signed-out verdicts). We can be sure more Card/Eyebrow migrations will not
produce a dollar. We cannot be sure the verdict→CTA path would convert if Regular volume
existed. Distribution is the next *experiment*, not a completed diagnosis that "it's not
product."

The Wk1 gate ("one real stranger pays") has never fired. The declared 30-day window closed
**2026-08-05**. Realized MRR: **$0 as far as any in-repo ledger can see.** That is not the
north-star's "<$250 with launch executed" case — the launch was never executed.

### 1.3 Cost (unchanged, marked)

Fixed burn remains the documented **~$75/mo** infra constant
(`DEFAULT_INFRA_COST_MONTHLY_USD` in `lib/unit-economics.ts`), inside the founder-approved
**~$125/mo** envelope (`docs/finance/budget.md`). LLM cost is still unmeasured. hop is
default-alive on cost; it is not a business until a dollar is attributed.

### 1.4 What the last six weeks of agent work actually did

Recent `main` is dominated by design-system Card/Eyebrow/Field migrations. The 2026-08-09
board memo (PR #411, draft — cited as evidence, not adopted policy) counted **24 of 44
commits (54%)** in the 08-02→08-07 window as that category, against a freeze the board had
voted twice. In the same window: N-386 stayed zero code; the three launch drafts stayed
unposted; PR #409 stayed unmerged; seats.aero stayed unanswered.

**The fleet can ship. It has been shipping the wrong queue.** Freeze design-system callsites.
Do not freeze funnel/CTA work once Regular volume exists (see §6 Phase C sample gate).

---

## 2. What remains true (do not re-decide)

From the 2026-07-04 plan, still load-bearing:

- **Category**: the points-vs-cash verdict engine. Never "AI travel planner."
- **One-liner**: every award tool can tell you a seat exists; hop tells you whether to burn
  *your* points on it — and an agent can ask the same question.
- **Launch price**: `$49/yr` annual-only, grandfathered, from `lib/pricing.ts`. Monthly
  `$9.99` stays configured and hidden. The $99/yr raise still needs all three July 4
  conditions (60+ days of reliable alerts *for paying users*, ≥8 programs past the
  live-valuation gate, receipts + newsletter). None of those clocks have started.
- **Free/paid line**: proactivity and volume (alerts, MCP quota), never verdict quality.
- **Four hard gates before billing is legitimate** (July 4 §3.1 — **unchanged**):
  ① R0.1 multi-pax — Passed (code), unobserved on live multi-pax.
  ② R0.2 one tested Stripe purchase — **Unknown**.
  ③ alerts firing — Passed (infra), unobserved on paying users.
  ④ seats.aero **off the commercial/paid search path** (amended 2026-08-21, ADR 0014) —
  unmet until chart-cpp is production and the Partner API is not called. Founder will
  not buy the commercial license. A fallback that keeps seats.aero as primary still
  does **not** pass. The billing flag is already ON; these gates constrain *keep-on /
  legitimacy*, not "whether to write the env var for the first time."
- **Break-even**: ~15–25 Pro/year, **or** ~6–12 card approvals/year, **or** one B2B
  pilot. 15 Pro at $49/yr ≈ $61/mo recognized — inside ~$75 infra only if LLM cost stays
  near zero; 25 Pro ≈ $102/mo is actually default-alive. Consumer subscriptions alone
  make a profitable side business, not a company. Company-scale is still the agent/B2B2C
  engine layer (July 4 §3.5 / §5 Upside).
- **No paid acquisition** until Regular activation is measurable. The $0/mo marketing
  line stands.
- **Affiliate money never reorders a verdict.**

---

## 3. What is now false, expired, or weaker

| Claim | Status | Replace with |
|---|---|---|
| "$10k+ MRR by 2026-08-05" | **Expired 2026-08-05 at $0.** The north-star doc itself called organic $10k in 30 days "far outside what any comparable tool has done." | Consumer readout: one attributed dollar. Company-scale: MCP + one B2B conversation, in parallel |
| "All R-items are open" (July 4 §7) | False. R0.1–R0.5, R1.x slices, July 4 B1–B4 (caveats in §1.1) are code-complete | Queue is seats.aero-off-paid-path (FD-charts) + distribution, not Phase 0 |
| "hop is first-mover in agent-native award search" | **False as of early August.** Gondola MCP is on the Official MCP Registry, PulseMCP, and Smithery; anonymous search; hotels + flights + cars; cpp inline | Remaining MCP edge: **stateful balances + first-party observed flight cpp**, not "we have an MCP" |
| "Balance-aware search is the differentiator" | **Table stakes.** point.me My Points, PointsYeah Wallet, Award Travel Finder | Do not pitch "we know your balance" as unique |
| July 4 B1–B4 as the next build | Mostly shipped | Do not rebuild pricing/quotas/runbook |
| `/stats` as the missing observed-cpp page | Count surface is live (14/34). Per-program public table is not | Fix "live bookings" copy (FD-copy). Park a public per-program table until Regular `verdict_viewed` volume exists |
| "A failover client unblocks billing legitimacy" | **False.** Gate ④ is seats.aero **off** the paid path (won't-buy, 2026-08-21). Failover with seats.aero still primary is availability, not a license | **FD-charts** (N-386 re-specified) is the legitimacy ticket. Live first-party search is quality, later |

Competitive prices, still the right comps: PointsYeah Premium ~$99.99/yr, point.me Standard
~$129/yr / Premium ~$260/yr. hop at $49/yr remains an honest early price. That only matters
once someone can pay on a licensed product.

---

## 4. The constraint

Three things bind. A fourth is self-inflicted.

1. **Distribution.** ~14 hop.flights visitors/week; three launch drafts unposted for 45
   days. SEO pages exist; they are not being pointed at. Activation cannot be measured
   until Regular volume exists.
2. **Data rights.** Award availability is still seats.aero **today**. Founder 2026-08-21:
   will not buy commercial terms. Gate ④ is now "off the paid path," not "wait for a
   letter." Until FD-charts is in production and the Partner API is not called, billing
   flag ON + public `/pricing` is still a present-tense identity risk for a brand whose
   claim is "hard gates, computed numbers." Plan: `2026-08-21-replace-seatsaero.md`.
3. **Founder action.** Highest-leverage remaining items are identity-bearing or
   hold-for-owner (ADR 0009): take seats.aero off Production (or flip billing off until
   FD-charts lands), posting under his name, merging `.github/workflows/**` (PR #409),
   deciding PR #373, CJ/Impact applications, Stripe/DB read. Agent cycles cannot substitute.
4. **Priority discipline.** Unblocked agent work that actually de-risks (FD-charts;
   "live bookings" copy) sat while design-system callsite migrations merged. N-386 as
   *failover* is retired; do not build that shape.

---

## 5. Honest math at current traffic

Arithmetic on documented inputs (`lib/pricing.ts`, funnel-log volumes, July 4 burn). Not
forecasts.

- **14 visitors/week × 0% Regular conversion = $0/year**, indefinitely.
- Even a generous 5% visit→Pro conversion on 14 visitors/week is ~0.7 Pro/week. At $49/yr
  that is ~$1.8k/year recognized *if* every converter pays on day one. More realistic: a
  handful of registered users/year — below 15–25 Pro break-even without a traffic
  step-change.
- **$49/yr ≈ $4.08/mo recognized.** 15 Pro ≈ $61 MRR (under $75 infra unless LLM ≈ 0).
  25 Pro ≈ $102 MRR — default-alive.
- **One card approval at documented $25–200 public payout** ≈ 0.5–4 years of one Pro sub.
  Network links do not exist; Regular outclicks do not exist. Application latency is still
  free — see A-cards.
- **Kiwi ~3% via Travelpayouts** is the only rail that can earn without a hop signup. It
  pays on a **booked ticket**, not a dashboard click.
- **$10k MRR at $49/yr still means ~2,450 paying subscribers.** Outside organic range from
  this baseline. Do not use it as a weekly desk target.
- **One B2B partner at $2–5k/mo** (July 4 §3.5) still dominates every consumer stream.
  That path does not wait for 15 Pro.

Implication: a Show HN spike can plausibly produce **one Kiwi commission**. It will not, at
0% Regular conversion, produce the Floor by itself. Floor is a readout of habit after a
real launch, not a 90-day company goal. Company-scale work (MCP listing + one R3.4
conversation) runs in parallel.

---

## 6. Path — legitimacy, then distribution, then a dollar; B2B in parallel

Later consumer phases start because an earlier "done means" fired — except the B2B track,
which does **not** wait on a consumer dollar.

### Phase A-legit — stop violating the plan (founder, before any public launch)

Do not post Show HN / r/awardtravel while billing is ON and gate ④ is unmet. The 2026-07-06
Show HN draft names "Seats.aero (live award space)" as a production upstream — that is a
public notice to the landlord. Rewrite it against chart-cpp (or live, if Stage B beat the
post) before sending.

| ID | Action | Done means |
|---|---|---|
| **A-terms** | Seats.aero (N-320) | **Won't-buy** (2026-08-21). Remaining: (1) `HOP_ENABLE_BILLING` flipped **off** until FD-charts is production and seats.aero is not queried, **or** (2) FD-charts in production + Production key/flag off, billing may stay on. **"We wait" while the flag stays ON and the Partner API is still the paid path is not a pass.** Record in `docs/ops-runbook.md` §Billing |
| **A-stripe** | One sentence of Stripe truth | "Zero paying subscribers" **or** "N test-mode" **or** "N live" in ops-runbook + finance ledger. Ends R0.2 *unknown*, not a docs contradiction (already marked Unknown) |
| **A-gov** | Merge or close [PR #373](https://github.com/n3wth/hop/pull/373) | `Auto-merge:` line in `docs/autonomy-runbook.md` matches a recorded decision. Governance, not revenue |
| **A-cards** | Submit CJ/Impact applications (July 4 §3.2 / R3.3) | Applications *submitted*, not approved. Latency is the timeline; zero Regular outclicks today does not make waiting free. Do not swap `applyUrl`s until approved |

Agents flag these. They do not flip flags, post under the founder's name, or merge
`.github/workflows/**`.

### Phase A-dist — distribution (founder; A-terms must have fired)

| ID | Action | Done means |
|---|---|---|
| **A-hn** | Rewrite then post Show HN (`docs/marketing/drafts/2026-07-06-show-hn-launch.md`) against §3. Do not advertise seats.aero as a live commercial feed. Lead with stateful balances + observed flight cpp; name the chart caveat if Stage B is not live yet | URL in the next funnel-log entry. This is the only A-dist action that can dwarf 14/week for a day or two |
| **A-reddit** | Rewrite then post the r/awardtravel math draft, or (better, matching July 4 GTM) start the weekly 10–15 "here's the actual math" reply habit | URL or a dated log of replies. One paste will not become a weekly visitor baseline; do not treat it as such |
| **A-mcp** | Merge or close [PR #409](https://github.com/n3wth/hop/pull/409) | Merged + first CI publish log inspected, **or** closed with a recorded reason. **May run in parallel with A-terms** (listing is not a hop.flights launch). Gondola already occupies this registry — listing is table stakes, not GTM. The 2026-07-17 Smithery/PulseMCP/mcp.so draft is a separate checklist, not this PR |

A-mcp is a listing. It is not a cash event. Anonymous registry traffic will not have hop
balances. Do not describe it as "the cheapest path to a dollar."

### Agent idle while A is pending (one item per run)

Not the first-dollar path. Do not open a design-system PR. Do not open a new board/strategy
memo instead of these.

| ID | Action | Done means |
|---|---|---|
| **FD-copy** | Stop calling search-time observations "live bookings" | `LiveValuationShelf` uses "observations" / "observed cash-vs-award samples" — **not** "bookings," **not** "redemptions." Copy-voice review. Matches `lib/valuation-telemetry.ts` |
| **FD-charts** | N-386 **replacement** (was "failover") | Chart-cpp per `docs/plans/2026-08-21-replace-seatsaero.md` §5. Facade `lib/awards.ts`; seats.aero not called when flag off; `availability: 'chart'`; cpp from `lib/cpp.ts`; chart rows skipped by valuation telemetry. **This is what passes gate ④** once Production key/flag is off. A failover that keeps seats.aero primary is **out of spec** |
| **FD-docs** | This PR + 2026-08-21 amendment | Playbook goal, ops-runbook R0.2 Unknown, July 4 pointer, AGENTS.md pickup, ADR 0014 | Done in this diff |
| **FD-live** | First-party live search | **After** gate ④. Cache-first Queue + Durable Object + calendar JSON (`2026-08-21-replace-seatsaero.md` §6). Search path never waits on a browser. Do not start while seats.aero is still the paid path |

**Parked (not the next ticket):** public per-program observed-cpp table. `/stats` already
ships the 14/34 count; the signed-in shelf already lists live vs baseline. Revisit after
Regular `verdict_viewed` volume exists or a posted draft actually sends people to `/stats`.

**Explicit freeze:** no new Card/Eyebrow/Field callsite migrations; no new `/guides` or
sweet-spot pages (N-387 still the content precondition); no further `/mcp` page polish
beyond what #409 needs; no Eve/hotels/`/compare` (July 4 kill list). Funnel/CTA work is
*not* frozen — it is gated on a Regular sample (Phase C).

### Phase C — attribute the first consumer dollar (after A-hn or a Regular-traffic step-change)

Done means: **one dollar in a named ledger**, Regular provenance, and billing legitimate
if the dollar is Stripe.

1. **Travelpayouts commission** (not a click) on a Regular `/api/go/kiwi` chain. Most
   likely first consumer dollar — no hop signup. Clicks stay a funnel leading indicator.
2. **Stripe** — one `hop_subscriptions` row whose price id matches configured Stripe
   prices, non-founder customer. **Only if billing is legitimate** (A-terms = seats.aero
   off the paid path). Test-mode is R0.2 evidence, not revenue.

`$virt_traffic_type = Regular` stays non-negotiable.

**Product-message read — sample, not a calendar.** After A-hn, do **not** declare the
funnel broken at two weeks. Re-read `components/VerdictRail.tsx` only after **≥50 Regular
`verdict_viewed`** (or ≥200 Regular sessions) post-launch. Until then the finding is
"still too little Regular demand to test the funnel."

A Kiwi commission during a Show HN hour is a **blip dollar**. It does not start a
"now chase 15 Pro" Floor program and it does not postpone B2B.

### Parallel — company-scale (does not wait on Phase C)

July 4 already said consumer subs are a side business and the prize is the engine layer.
Gondola is on the registry now. The month-6 B2B checkpoint is ~2026-12-04. Do not spend
that window as a consumer Floor hunt.

| ID | Action | Owner | Done means |
|---|---|---|---|
| **A-mcp** | Official MCP Registry listing | founder merge of #409 | see above |
| **R3.4** | One warm issuer / fintech / credit-union conversation with the MCP demo | founder | A named conversation logged in `docs/finance/outreach.md`. One signed API partner at $2–5k/mo dominates Floor |
| MCP packaging | Only after #409: install story that leads with stateful balances + observed flight cpp vs Gondola's anonymous multi-vertical search. Not `$49 Pro quota` as the B2B product | agents, after listing exists | A stranger can connect and get a verdict; metered B2B price is a later ticket (July 4 M8), not this 90 days |

Do not route MCP success into "funnel into $49/yr Pro" as the B2B plan. Free 25/day can
stay the consumer/agent trial; the company product is a partner conversation.

### Floor (readout, not a gate)

The July 4 §5 Floor (~15 Pro/year *or* equivalent affiliate, costs covered) is what
default-alive looks like **if** Regular habit appears after a real launch. It is not the
90-day company target. Do not open Phase-D "chase 15 Pro" work on a blip dollar.

Card affiliates enter once A-cards is approved *and* Regular traffic exists. Escalation
$149 still waits on ≥5 qualified leads/month (July 4 §3.4). Media-engine M-series may
start only where they cost ~$0 and do not jump FD-charts / A-terms. M6/M7 stay parked.

---

## 7. Requirements (this plan, this PR)

- [x] `AGENTS.md` sequences the next 90 days here; July 4 still owns pricing/gates.
- [x] `docs/agent-playbook.md` §The goal no longer states "$10k+ MRR by 2026-08-05" as live.
- [x] `docs/ops-runbook.md` no longer claims both "R0.2 still owed" and "R0.2 Passed."
- [x] July 4 business plan carries a dated pointer here.
- [x] Pickup rule: without Linear, take **FD-copy** then **FD-charts**. With Linear, skip
      any issue that is not those, FD-live after gate ④, a Phase A flag, or R3.4 packaging
      after #409. Do not pick a shipped July 4 `B#` epic. Do not build seats.aero-primary
      failover.

Non-goals of *this* PR: do not flip `HOP_ENABLE_BILLING`; do not merge #373 or #409; do
not implement FD-charts application code in the 2026-08-20 docs PR (the 2026-08-21 plan
is the spec); do not invent a price; do not spend on ads; do not reopen Eve,
hotels, or `/compare`; do not build the public per-program cpp table.

---

## 8. Files to touch (this plan's own diff)

| Path | Change | New? |
|---|---|---|
| `docs/plans/2026-08-20-path-to-first-dollar.md` | this document | yes |
| `docs/plans/2026-07-04-business-plan.md` | header + §13 pointer | no |
| `docs/README.md` | index rows | no |
| `AGENTS.md` | layout + §What-to-build-next | no |
| `docs/agent-playbook.md` | §The goal; ownership order | no |
| `docs/ops-runbook.md` | R0.2 Unknown; billing legitimacy | no |
| `docs/finance/budget.md` | flag ON vs legitimacy, not "off" | no |
| `docs/plans/2026-07-05-agentic-travel-agent-northstar.md` | expired-target banner | no |
| `docs/team/routines.md` | Marcus orient line | no |
| `docs/solutions/2026-08-20-first-dollar-is-distribution-not-product.md` | compound | yes |

No application code in this PR.

---

## 9. Engine hooks (constraints on FD-charts / FD-copy / FD-live, not this diff)

- **FD-copy**: `sampleSize` from `liveValuationStats` / `getLiveValuations` is observation
  count. UI string must not say bookings or redemptions.
- **FD-charts**: facade `lib/awards.ts`; chart-cpp default; `HOP_ENABLE_SEATSAERO` double-lock
  off in production. Rows still go through `assembleSearch` + `lib/cpp.ts`.
  `{ok:false}` → existing `degraded[]` `'awards'`. Never fabricate cpp. Chart rows
  carry `availability: 'chart'` and **must not** POST to `recordCppObservations`.
  **seats.aero is not the paid path.** Spec: `docs/plans/2026-08-21-replace-seatsaero.md`.
- **Tests**: flag off → seats.aero client not called; chart miles/taxes from tables; cpp
  formula unchanged; AA/DL omitted in Stage A; valuation telemetry skips chart rows.

---

## 10. Copy notes (FD-copy)

`docs/design/copy-spec.md`: terse, state the number, no marketing slop.

- Current: `{stat.sampleSize} live bookings` — false.
- Ship: `{n} observed cash-vs-award samples` (or "observations").
- Do not ship "redemptions" as the replacement — same class of error.

`/stats` intro is already honest. Keep that voice.

---

## 11. How an LLM agent picks this up

1. Read `AGENTS.md`, then this doc, then July 4 §2–§3 (positioning, pricing, gates — do
   not re-derive).
2. **Pickup, with or without Linear:** FD-copy if the string is still "live bookings";
   else FD-charts (`2026-08-21-replace-seatsaero.md` §5) if `lib/awards.ts` is missing;
   else FD-live only after ops-runbook shows seats.aero off in Production. Skip
   design-system, skip new `/guides`, skip shipped July 4 B1–B4, skip a public `/stats`
   table, skip a new weekly memo as a substitute, skip seats.aero-primary failover.
3. Founder-gated (A-terms, A-hn, A-mcp, A-gov, A-cards, R3.4): **do not impersonate.**
4. Never generate an economic number, throw from a `lib/*` client, ship an ungated seam,
   touch the live Duffel key, or start a frozen item.

---

## 12. Kill / freeze / default-alive

| Trigger | Action |
|---|---|
| 90 days after **A-hn and A-mcp** have fired, still zero Regular conversion **and** zero third-party MCP tokens | hop runs default-alive. Agent fleet → maintenance + FD-charts/FD-live if still unbuilt. No new M-series |
| 90 days after **this plan is adopted** if A-hn **or** A-mcp still unfired | Same maintenance outcome. Do not wait forever on founder actions that have already sat 45 days |
| Billing flag still ON and gate ④ still unmet **30 days after adoption** (silence *or* still on the Partner API) | Next board memo's #1 is "flip billing off." Agents still do not flip the flag |
| FD-charts never ships | Kill paid features that depend on award availability, or flip billing off. Cash + affiliate + observed-cpp-from-cash-only remains. Do not turn seats.aero back on |
| First attributed **commission or legitimate Stripe charge** | Dated addendum here naming the stream. Do not start a Floor-chase program on a Show HN blip. Growth attention → activation on *new Regular* sessions (program added → second search → outclick) |
| First named R3.4 conversation | Dated addendum; that track outranks consumer Floor work |

The July 4 month-6 checkpoint (~2026-12-04: if no B2B conversation and Base isn't tracking
→ default-alive) still stands. This plan is how to not arrive there having never launched
*and* having never had the B2B conversation.

---

## 13. Review hooks & compound

- Docs review already run (adversarial, product, scope, coherence). P1s folded: gate ④
  is seats.aero **off** the paid path (won't-buy, 2026-08-21); FD-charts is legitimacy,
  FD-live is quality; failover-with-seats-primary is out of spec; "we wait" on the
  Partner API is not an A-terms pass; Phase IDs no longer collide with July 4 B1–B4;
  A-hn does not precede A-terms; first dollar is a commission not a click; B2B is
  parallel not behind Floor; 90-day kill has a dual clock; copy says observations not
  redemptions; chart rows are not live space and do not feed ADR 0005.
- Compound: `docs/solutions/2026-08-20-first-dollar-is-distribution-not-product.md` and
  `docs/solutions/2026-08-21-dont-clone-seatsaero-replace-the-search.md`.

---

## 14. Addendum — 2026-08-21 (won't-buy seats.aero)

Founder: commercial license is unaffordable; do not depend on seats.aero. Spec:
`docs/plans/2026-08-21-replace-seatsaero.md`. ADR 0014.

This file's A-terms / gate ④ / pickup / kill rows above are edited in place so agents
do not follow the retired "written terms or failover-while-primary" fork. Application
code is still the next ticket (FD-charts), not this docs PR.
