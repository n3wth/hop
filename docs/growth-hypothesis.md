# Growth hypothesis: one funded agent-team month

Status: hypothesis, not a plan. Written 2026-06-30, ~24h into the build. Forward-looking
sections are explicitly speculative; the "Where we are" section is grounded in current code.
Numbers that depend on market conditions or traffic are approximate.

Premise: a team of agents working hop for one month, with capital to spend on data, acquisition,
and compliance. What is realistically buildable, and what would actually move the business.

## Where we are (grounded in the code)

The bones of a real business already exist:

- **Verdict engine** — `lib/search.ts#assembleSearch` fans out to upstream sources, computes
  per-option economics in `lib/cpp.ts` (`cpp = (cash − taxes) × 100 / miles`,
  `POINTS_THRESHOLD_CPP = 2.5`), ranks, and renders a verdict. Always resolves, never throws;
  every number is computed, never generated.
- **Live integrations** — Duffel (cash), seats.aero (award space), AwardWallet (balances),
  transfer reachability, dual auth (Auth0 identity + Supabase data).
- **Monetization is already wired** — credit-card CTAs on points-winning verdicts; cash CTAs
  deep-link to the Kiwi affiliate.
- **Booking is scaffolded but gated** — `/book` + `/book/confirmation` exist; native Duffel
  checkout is behind `isCheckoutEnabled()` (`HOP_ENABLE_CHECKOUT` + a test key). The loop is
  built, not yet switched on.
- **Distribution is seeded** — SEO sweet-spot + destination guide trees.
- **Agent-native** — a live MCP server (`app/api/[transport]/route.ts`, "Add to Claude")
  exposing `price_trip`, `verdict`, `sweet_spots`, `transfer_paths`, with optional `hop_` Bearer
  tokens that load a user's real balances.
- **Proactive layer started** — the `eve/` agent scaffold and a `standing-orders` cron
  (`/api/cron/standing-orders`, every 6h) are the primitives for alerts and a proactive concierge.

## The strategic read

With agents, **code stops being the constraint** — features and content are nearly free to
produce. The binding constraints become **distribution, data rights, and trust**. Plan the month
and the spend around those three, not around shipping more screens.

## Three parallel tracks

Agents are good at parallelism. Run three teams.

### 1. Close the loop: verdict → booking → revenue

hop recommends today. The money move is to execute and retain.

- Flip `HOP_ENABLE_CHECKOUT` once payments compliance is handled; book cash via Duffel inline;
  assist/deep-link award bookings; capture the card-affiliate moment at the verdict.
- Make **Eve** real: turn the `standing-orders` cron into price/award **alerts** — the actual
  retention engine ("Tokyo business just opened at 60k on your ANA balance"). Watchlists,
  household point pooling, positioning and multi-leg logic.

This is what turns a lookup tool into a habit.

### 2. Programmatic distribution

The SEO trees are seeded; agents extend the long tail cheaply.

- Route × program × "points or cash" pages; "is [card] worth it" pages that feed the affiliate
  engine; sweet-spot and destination guides.
- One free viral hook: "paste your balances, see your map." An embeddable verdict widget.
- Launch into r/awardtravel, FlyerTalk, Product Hunt, HN.

SEO compounds over months, so month one is about getting the machine indexed and landing the
first launch spike, not about month-one traffic.

### 3. Agent-native B2B (the moat)

Harden the MCP server into a product: "hop for agents." Any chatbot, travel app, or AI assistant
calls hop for a points-vs-cash verdict + award availability, metered as a paid API. Ship a
Claude/ChatGPT app and a browser extension that overlays the verdict on Google Flights and airline
sites. point.me and PointsYeah own consumer subscription; nobody owns the agent surface yet. This
is the bet hop is uniquely positioned to make.

## Monetization and a realistic day-30 picture

Spend goes to: API/data tiers (Duffel, seats.aero, LLM tokens), compliant card-affiliate
relationships, paid acquisition, and legal for handling bookings and payments.

| Model | Status today | Day-30 realistic |
|---|---|---|
| Credit-card affiliate | CTAs wired on points verdicts | First approvals; multi-month SEO lag |
| Cash booking take-rate | Kiwi deep-link; Duffel checkout gated | Checkout on; first booked-cash revenue |
| Subscription (alerts, pooling, unlimited search) | not built | Starter tier at $5–15/mo |
| Agent/MCP API | live, unmetered | First metered B2B user |

- **Likely**: a polished, genuinely useful product; booking loop on; hundreds–low-thousands of
  programmatic pages indexed; a launch spike; first affiliate dollars and first API users. This is
  proof-of-mechanic, not profit — the card-affiliate model lags by months.
- **Upside**: a couple of card approvals/month (~$150–300 bounty each) + a starter subscription +
  a first B2B API customer → a credible "this monetizes" story to raise on or run profitably.
- **The honest day-30 deliverable is a fundable, launched product with a proven revenue
  mechanic** — not a cash-flowing company yet.

## What decides whether it is real

- **Data and ToS** — airlines are hostile to award-arbitrage tools; card-affiliate programs are
  compliance-heavy (CARD Act, issuer rules). Use capital to buy legitimate data partnerships and
  compliant affiliate relationships rather than scraping into a takedown.
- **Trust and accuracy** — one wrong verdict that costs someone a trip kills the brand. Keep the
  verdict engine conservatively correct; the "always resolves, never fabricates" invariant is the
  product, not a detail.
- **Moat** — the opinionated "hard verdict" UX and agent-native distribution are the two edges.
  If neither compounds, hop is a feature, not a company.
- **Affiliate concentration** — TPG-style revenue lives and dies by issuer relationships; one
  issuer change can gut it.
