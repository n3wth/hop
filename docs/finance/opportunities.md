# Startup credit / discount opportunities

Tracked programs hop could apply to. Rejected or already-pitched opportunities stay listed
(marked) so they aren't re-pitched. **No application is submitted by this desk** — drafts below
are answers ready for Oliver to review, approve, and submit himself (or explicitly authorize
submission).

## Status legend

`tracked` (researched, not yet applied) · `drafted` (answers ready, awaiting Oliver's go-ahead)
· `submitted` (Oliver applied) · `rejected` (do not re-pitch) · `accepted`

---

## 3. HubSpot for Startups (free ad-credit + tool-perk aggregator) — `drafted`

- **Eligibility**: free to join, explicitly "no purchase or credit card required." General
  HubSpot for Startups program terms target early-stage/bootstrapped companies; no VC backing
  required for the base tier.
- **Value**: not a direct credit itself — it's a gateway that unlocks a bundle of partner offers
  in one sign-up, several of which are the "free ad credit" Oliver asked for: ~$1,000 Google Ads
  credit, ~$1,000 LinkedIn Ads credit, up to ~$6,000 TikTok Ads credit, plus Reddit Ads credit and
  non-ad perks (Notion, Clay, Gamma, AWS, Anthropic/Claude offers). Redeeming each individual
  offer still requires its own sign-up per platform.
- **Effort**: low — one sign-up form, no card required, unlocks the rest.
- **Deadline**: rolling.
- **Why it fits**: single lowest-friction entry point to the ad-credit hunt Oliver asked for
  this run, and it's genuinely free to join (unlike the ad platforms themselves — see below).
- **Recommendation**: apply now — zero cost, zero commitment, worth doing purely to see the
  live offer list (which changes over time and isn't fully published outside the portal).
- **Approval needed**: Oliver to sign up (company email/website, standard startup-program form)
  — this desk doesn't hold the account. No card requested at this step.

---

## 4. Reddit Ads "spend $500, get $500" credit — `drafted`, spend required — [needs-founder]

- **Eligibility**: new Reddit Ads account (or no prior spend), no funding-stage requirement.
  Self-serve at redditforbusiness.com/advertise-with-bogo.
- **Value**: Reddit matches new advertisers' spend dollar-for-dollar, up to $500 (some
  promo/partner links have shown higher tiers, e.g. $1,500 matched — terms vary and would need
  reconfirming at signup time).
- **Effort**: low to set up, but **this is not free** — it requires actually spending $500 of
  real money to unlock the $500 credit. That is a real marketing-spend commitment, which
  conflicts with the budget envelope's current $0/mo marketing line (`budget.md`) unless Oliver
  explicitly approves the spend.
- **Deadline**: rolling signup; the match must be spent within ~30 days of redemption once
  claimed.
- **Why it fits**: of every ad platform checked, Reddit is the strongest audience fit for hop —
  r/awardtravel, r/churning, r/travelhacks, r/personalfinance are exactly hop's target user
  (points/miles-literate travelers) and Reddit's CPMs for this niche are reported as
  under-priced relative to Google/LinkedIn (fewer advertisers competing for these subreddits).
- **Recommendation**: worth doing if/when Oliver wants to commit real ad spend — this is the
  best $-for-$ channel found, not a no-cost opportunity. **Do not commit spend without Oliver's
  explicit sign-off**, per this desk's standing rule (never spends money).
- **Approval needed**: Oliver's explicit go-ahead on the $500 spend, plus the Reddit Ads account
  itself (payment method required).

**Honest framing for the memo**: checked Google Ads, Meta, TikTok, LinkedIn, Microsoft/Bing,
Snapchat, Amazon, and X — every major ad platform's "startup credit" is a **spend-match**
(you pay first, then get matched credit), not free money. There is no real no-cost ad-credit
program among major platforms; HubSpot for Startups (above) is the closest thing to a genuinely
free step, and it's a gateway to the same spend-match offers, not cash.

---

## 5. Resend for Startups (extended free tier + email credits) — `drafted`

- **Eligibility**: bootstrapped/pre-seed/seed, no VC referral required, new-to-the-program
  Resend customer, production use case. Apply at resend.com/startups with use case and
  expected volume; review takes 2-7 business days.
- **Value**: extended free-tier sending limits + email credits for higher volume (exact
  credit amount not published on the program page — confirmed at application/approval time).
  Covers email API, audience management, webhooks.
- **Effort**: low — one application form, no card required to apply.
- **Deadline**: rolling.
- **Why it fits**: hop already uses Resend for transactional email today (the `$0-20/mo`
  Resend line in `budget.md`'s infra estimate) — this is a real, existing cost line, not a
  speculative one, and the best-fitting credit found this run.
- **Recommendation**: apply now — zero cost, zero commitment, direct offset for a real
  infra line.
- **Approval needed**: Oliver to submit via the Resend account hop already uses (this desk
  doesn't hold the account/API keys).

---

## Considered, not pursued (this run) — AWS / Google Cloud

Researched per the prior run's "candidate for a future run" note. Both have a real,
no-VC-required entry tier, but neither offsets an existing hop cost line — hop's infra is
Vercel + Neon + Cloudflare, with zero AWS or GCP usage today, so redeeming either credit
would mean standing up new cloud spend just to consume free credits, not saving anything.
Not drafted as applications.

- **AWS Activate Founders** — $1,000 in AWS credits + $350 AWS Developer Support credits,
  1-year validity. Eligibility: self-funded, <10 employees, <$1M revenue/funding,
  pre-Series B, no VC/accelerator affiliation, founded <10 years, needs an AWS account on a
  **paid tier plan** (billing method on file) and a corporate email domain (not gmail —
  `oliver@newth.ai` is a personal domain, not `hop.flights`, which may also block
  application). No fit without existing AWS usage.
- **Google for Startups Cloud Program — Start tier** — $2,000 in Google Cloud credits,
  12-month validity, usable only on GCP services (BigQuery, Gemini Enterprise, etc.).
  Eligibility: founded within the last 24 months, working MVP, explicitly framed around
  startups "with plans to seek venture funding soon" — in tension with hop's bootstrapped
  stance, and no GCP usage to offset regardless.

---

## 1. Anthropic Startup Program (Claude API credits) — `drafted`

- **Eligibility**: explicitly open to bootstrapped founders, no VC backing required (per the
  official program page). Soft guideline of "founded within the last 4 years" — discretionary,
  not a hard block; hop's codebase is a few days old, well inside any window. Requires: Claude
  Console (console.anthropic.com) account, company email, website, one-line description, and
  that the company hasn't previously received Anthropic startup credits (hop hasn't).
- **Value**: self-apply "Standard" tier commonly $1K-$5K in Claude API credits, 12 months
  validity, plus upgrade to highest API rate limits. Higher tiers ($5K-$25K+) need a VC/partner
  referral — not applicable to hop.
- **Effort**: low — ~2-minute self-serve form, no card required to apply.
- **Deadline**: rolling, no deadline.
- **Why it fits**: hop's concierge (`/ask`) runs directly on the Claude API
  (`@anthropic-ai/sdk`) and this desk itself runs on Claude Code — real, growing Anthropic
  spend that credits would directly offset. `llmCostUsd` in `lib/unit-economics.ts` is
  currently unmeasured (`null`); this would be the first real signal on that cost line.
- **Recommendation**: apply now. Zero cost, zero commitment risk, direct cost offset for a real
  usage line.
- **Approval needed**: Oliver to create/confirm the Claude Console account under a company
  email and submit — this desk cannot create external accounts or submit forms.

**Drafted application answers** (fields per the public application form):

> **Company name**: hop (hop.flights)
> **Website**: https://hop.flights
> **Company email**: oliver@newth.ai *(confirm a company-domain address exists, e.g.
> founders@hop.flights, before submitting — some programs prefer a non-personal domain match)*
> **One-line description**: hop is the points-vs-cash flight verdict engine — it knows a
> traveler's real loyalty balances and computes live cents-per-point economics to tell them
> whether to book with points, transfer partners, or cash, exposed to both humans and AI agents
> via an authenticated MCP server.
> **How you use Claude**: Claude powers hop's AI concierge (`/ask`), a chat surface grounded in
> the user's real point balances and destination data that explains points-vs-cash tradeoffs in
> plain language; all economic numbers (cpp, tiers, verdicts) are computed by deterministic
> code, never generated by the model, so Claude's role is explanation and conversation, not
> arithmetic. hop also exposes an MCP server so any Claude-based agent can call the same verdict
> engine directly.
> **Funding status**: bootstrapped / self-funded, solo founder, no institutional investment to
> date.
> **Founded**: *(Oliver to confirm actual company founding date — do not infer from repo
> history, which only reflects recent code activity)*

---

## 2. Cloudflare Startup Program — Bootstrapped/Stealth tier ($5K credits) — `drafted`

- **Eligibility**: "Bootstrapped or self-funded; under $1M raised" tier, no minimum funding
  required. General program criteria: building a software product with an active website,
  founded within the last 5 years, valid matching email. hop clears all of these.
- **Value**: $5,000 in Cloudflare credits, ~12 months validity (per-product sub-limits apply,
  e.g. up to $50K of the credit poolable to Workers AI, $10K to R2/Cache Reserve — not relevant
  at hop's scale). The scaling $250K tier requires Tier-1 VC/accelerator backing or Workers
  Launchpad participation — not applicable to hop today.
- **Effort**: low — self-serve application via cloudflare.com/startups, requires a Cloudflare
  account with a payment method on file (credits then offset billed usage).
- **Deadline**: rolling, no deadline.
- **Why it fits**: hop already runs three production Cloudflare Workers —
  `cloudflare/valuations-worker` (D1-backed cpp aggregation, cron-driven), `balance-sync-worker`,
  and `balance-fetch-worker` (uses Browser Rendering for credential-based balance sync). This is
  real, metered infra spend today, not speculative future usage — the strongest kind of fit for
  a credits program.
- **Recommendation**: apply now. Directly offsets an existing, real cost line; no downside.
- **Approval needed**: Oliver to confirm/create the Cloudflare account and payment method (a
  card must be on file per program terms) and submit — this desk does not hold payment
  instruments or submit external forms.

**Drafted application answers**:

> **Company name**: hop (hop.flights)
> **Website**: https://hop.flights
> **Funding status**: bootstrapped / self-funded, under $1M raised (in fact: $0 raised)
> **Founded**: *(Oliver to confirm actual company founding date)*
> **Product description**: hop is a points-vs-cash flight verdict engine with a companion AI
> concierge and an MCP server for agent access. Cloudflare is used for: (1) `valuations-worker`
> — a Workers + D1 service that aggregates first-party observed cents-per-point samples across
> loyalty programs on a cron schedule; (2) `balance-sync-worker` and `balance-fetch-worker` —
> Workers (the latter using Browser Rendering) that keep a user's real loyalty-program balances
> current via scheduled sync.
> **Which Cloudflare products**: Workers, D1, Browser Rendering (Workers Cron triggers).

---

## Considered, not pursued this run

- **PostHog for Startups** ($50K credits, <2 years old, <$5M raised, no VC required) — hop
  clears eligibility and already uses PostHog for product analytics per the ops runbook, but
  usage is almost certainly still inside PostHog's free tier at hop's current traffic, so the
  credit has little near-term offset value. Worth revisiting once traffic/event volume grows;
  not tracked as a drafted application this run to keep this week's ask to two.
- **Vercel for Startups** (~$30K credits) — the standard self-serve tier commonly requires
  accelerator/VC affiliation (YC, a16z, Accel, etc.) for the meaningful credit amount; hop has
  neither. Lower-value bootstrap path unclear from public sources. Not pursued.
- **Neon Startup Program** (up to $100K-$200K) — public criteria seen (via a partner listing)
  specify "raised at least $1M in total funding" — hop does not qualify. Not pursued.
- **Stripe Startups program** — explicitly "for venture-backed businesses" — hop does not
  qualify. Not pursued. (hop already uses standalone Stripe fee credits if/when issued, which
  is a different, non-application mechanism.)
- **Duffel startup/partner credits** — no public startup-credit program found; Duffel is
  pure pay-as-you-go ($3 + 1%/confirmed order). The real Duffel-related owner action is the
  commercial-terms conversation already tracked in the business plan (§7 owner actions), not a
  credit application — not duplicated here.
- **AWS Activate / Google for Startups** — researched 2026-07-06, see the dedicated section
  above; no fit today given zero AWS/GCP usage. Revisit if that changes.
