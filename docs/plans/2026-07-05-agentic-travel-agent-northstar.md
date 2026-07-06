# hop as a true AI-first personal travel agent — the north-star plan

Adopted 2026-07-05. This is the vision + sequencing document for hop's evolution from "a search
tool with AI features" into **an agent that owns your travel outcomes**. It extends (does not
replace) `2026-07-04-business-plan.md`; where they conflict on sequencing, the business plan's
revenue gates win. Written for any reader — human or agent — with terms defined as they appear.

## What "AI-first agentic" means here, concretely

Today a user operates hop: they search, read a verdict, click. The end state inverts that:
**the user states an outcome; hop's agent owns it end to end.**

> "Get the two of us to Tokyo in business next spring for under 160k points total."
> …weeks later: "Booked would work — ANA via Amex→Virgin at 90k each is live for Apr 14. It saves
> $6,120 vs cash (3.4¢/pt). Approve and I'll hold it now."

Four principles, non-negotiable:
1. **The engine computes, the agent orchestrates.** Every number (cpp, savings, ranking, verdict)
   still comes from deterministic `lib/*` code — the LLM never invents one. The agent decides
   *when to look, what to propose, how to say it* — never *what the math is*. (ADR: engine as
   source of truth.)
2. **Proactive beats reactive.** The durable habit isn't "open hop and search" — it's "hop tells
   me when acting is worth it." Watches, standing orders, and schedules are the primary product;
   the search page is just the agent's workbench made visible.
3. **Every capability is an agent tool first.** Anything a user can do in the UI must be callable
   by an agent (hop's own Eve, or an external agent via MCP). UI = one client of the tool layer.
4. **Humans approve irreversible things.** Spending money, transferring points (one-way!), and
   canceling bookings always require an explicit human yes. Everything reversible, the agent does.

## What already exists (build on, don't rebuild)

- Verdict engine (`lib/search.ts#assembleSearch`) + cpp economics + transfer reachability.
- The traveler's data: balances resolver (manual + AwardWallet snapshot + credential sync),
  Gmail travel history (live as of 2026-07-05), natural-language prefs (`lib/prefs-model`).
- Proactive plumbing: watches/standing orders + 6h cron + email delivery; valuation telemetry.
- Conversation: `/ask` concierge (streamed, engine-grounded); MCP server (price_trip, verdict,
  sweet_spots, transfer_paths); Eve scaffold (`eve/`, ADR on co-location) — deliberately dormant.
- Native checkout seam (Duffel test-key gated, off) + booking request pipeline.
- The autonomous staff org (docs/team/routines.md) shipping product while the founder sleeps.

## The five pillars, in order

### P1 — One traveler profile (the agent's memory)
A single `lib/traveler-profile.ts` resolver that composes what exists: balances, travel history,
prefs, home airports, party size, upcoming trips. One call answers "who am I advising?" Every
surface and tool consumes it; nothing reads the pieces directly anymore.
**Done when:** concierge, search, deals, watches, and MCP all consume the profile; a new data
source (e.g. calendar) can be added in one place. Mostly composition work — small.

### P2 — From alerts to proposals (the agent acts first)
Upgrade watches from "cpp crossed 2.5, here's an email" to **proposals**: a rendered, engine-priced
recommendation with a one-tap approve path and an expiry ("this held space typically lasts ~48h").
Add agent-initiated watches: after any search or concierge chat, the agent offers to keep working
the problem ("want me to watch spring business fares to Tokyo across your programs?"). Delivery
must be idempotent (a re-run never double-sends) — the Eve architecture review rules apply.
**Done when:** >half of value delivered (measured as proposal-opens leading to outclicks/bookings)
originates from hop reaching out, not the user searching.

### P3 — Conversation as the primary interface, on the user's channels
The concierge stops being a page and becomes *the* interface, reachable where the user already is:
- **Email**: each user can email their agent (the AgentMail/pretty-address pattern already proven
  by balance-sync ingest); replies are engine-grounded proposals.
- **Phone/voice**: the ElevenLabs hotline pattern (already provisioned for the founder) becomes a
  per-product concierge line — call, state the trip, get the verdict read back, approve holds.
- **External agents**: the MCP server is a distribution channel — a user's Claude/other assistant
  plans trips through hop's tools with the user's token. Treat MCP polish + quotas as GTM, not
  plumbing (it is also the moat's shop window: computed numbers other AI products can't fake).
**Done when:** a real trip is planned end-to-end on each channel without opening the website.

### P4 — Agentic booking (the agent's hands)
Behind the existing flags: approve → the agent executes — holds award space where programs allow,
books cash via Duffel (test key until volume justifies risk review), files the itinerary back into
travel history, then **keeps watching the booking** (schedule changes, better-award-opens →
rebooking proposals). Points transfers remain propose-only (irreversible) with guided deep links.
**Done when:** one real booking flows approve→booked→monitored with zero founder involvement.

### P5 — The compounding loop (why this gets better every week)
Every search emits cpp observations (live); every proposal records outcome (taken/ignored); every
booking records realized savings. That first-party outcome data feeds: better valuations (live
overrides), better proposal timing, and **publishable receipts** ("hop members averaged 3.1¢/pt on
Alaska last month") — which is the content pipeline's strongest material and the trust engine's
proof. The agent org (growth desk) publishes it; the trust page displays it.
**Done when:** valuations, proposals, and marketing all demonstrably consume outcome data.

## Sequencing & ownership (next ~90 days)

| Order | Work | Owner | Gate |
|---|---|---|---|
| 1 | P1 traveler profile composition | autopilot (Jeffrey) | none — pure refactor |
| 2 | P2 proposals + agent-offered watches | planned PR wave | R1.5 receipts ship first (business plan) |
| 3 | P3a email channel (per-user agent address) | planned PR wave | reuses ingest pattern |
| 4 | P3c MCP-as-GTM polish (quotas shipped 2026-07-05) | growth desk assist | pricing live |
| 5 | P4 booking execution behind flag, founder-only dogfood | needs founder review | HOP_ENABLE_CHECKOUT + test key |
| 6 | P3b voice line | after P3a proves demand | ElevenLabs cost approval (Elizabeth) |
| 7 | P5 outcome-data receipts in content + trust | growth desk | needs P2 volume |

Weekly retro (Bob) re-ranks this table against reality; the board memo's amendments
(docs/board/) may reorder it — revenue gates from the business plan always win ties.

## The revenue goal — $10k+ MRR within 1 month (declared 2026-07-05)

The founder's stated target. Stated honestly: at $49/yr (≈$4.08/mo recognized), $10k MRR means
**~2,450 paying subscribers in 30 days, starting from 1 user** — that is far outside what any
comparable tool has done organically, so this goal only functions as a forcing device if we treat
the weekly checkpoints as real and act on misses instead of narrating them:

- **Wk 1 gate: payment path proven.** Monetization PR merged + one real stranger pays. If nobody
  CAN pay, nothing else matters. Owner: merge queue + founder approves launch drafts.
- **Wk 2 gate: $250 MRR-equivalent** (~60 subs or mixed monthly). Requires the launch actually
  fired: Product Hunt / HN Show / r/awardtravel receipts posts (drafts come from the growth desk;
  ONLY the founder can credibly post — 15 min/day from vacation is the single highest-leverage
  human act in this plan).
- **Wk 3 gate: $1k.** Requires a working referral/receipts loop (P5 material) and MCP directory
  presence ("add hop to Claude" is the differentiated distribution bet — pursue listing).
- **Wk 4: honest read.** $10k = triumph. $1–3k = real business forming; keep the org running.
  <$250 with launch executed = the board's kill-criteria question is live — reprice (monthly
  tier, higher annual), reposition, or pivot the wedge (MCP/B2B: "points engine for AI agents").

Pricing lever the CFO desk should model in week 1: $49/yr recognizes slowly; a $9/mo tier
changes the MRR math 2.2× per subscriber and gives a cancelable low-commitment entry.

## Guardrails that make this safe to build unattended

- Engine invariant reviews stay mandatory on every PR touching a number.
- Approval gates: transfers/spend/cancel = human-only, forever the default.
- Program ToS: credential-sync and award-holding behaviors get a per-program allowlist and an ops
  runbook section before any expansion (account bans are the existential risk of this category).
- Cost bounds: every new agent loop gets a per-run budget and a heartbeat, like the desks have.
- Kill switches: every proactive channel ships with a one-line disable flag in `lib/env.ts`.
