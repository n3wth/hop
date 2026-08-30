# hop — Board Review Memo (2026-07-12)

## 1. State of the company

Real GTM progress shipped since last week's review: verdict receipts (R1.5, PR #253), newsletter
capture (R1.6, PR #251 + two hardening passes), and the public `/mcp` page (R2.1, PR #280) — the
board's own top three amendment items — are all done, with commit evidence. Five transfer-partner
program guides also shipped (PR #275). The admin-UI/nav-polish freeze **held this week** — the
first clean week since it was declared two retros ago. Traffic is real and rising (48→61→95
visitors/7d across three funnel-log reads) with improving bounce/engagement signals.

Against that: **nothing changed on the billing-gate contradiction the board voted on last week.**
`HOP_ENABLE_BILLING` is still ON; the seats.aero written-terms email sent 2026-07-06 has no
recorded reply six days later (Linear N-320 still Backlog); no real Stripe purchase has landed
(N-321 also still Backlog). The public `/pricing` page the board explicitly kill-listed is still
live, still publicizes "$49/yr" in its page metadata regardless of the billing flag's state
(`PRO_PRICE_YEARLY_USD` is a static constant, not gated), and — new this week — gained a fresh
public inbound link from the `/mcp` page (`app/mcp/page.tsx:178`), making it *more* discoverable
than a week ago, not less. And the funnel's core numbers are now a three-times-repeated pattern,
not early noise: `signed_up` and `first_program_added` are **zero** across all three reads since
instrumentation shipped, against nearly double the traffic.

**One correction to how this desk read the org last week's retro:** the apparent "strategy desk
has never produced output" read is not a desk failure. `docs/team/routines.md` shows the board
review cron (`0 13 * * 0`) fires two hours *before* the strategy desk's cron (`0 15 * * 0`), every
Sunday — so this review, structurally, can never see that week's strategy output; it will only
ever see last week's (or, in weeks 1–2, none at all, since Marcus's very first scheduled slot is
later today). This is a scheduling bug worth fixing, not evidence the desk is broken — see the
amendment list.

## 2. Follow-through on last week's amendments — what actually happened

| # | Amendment | Status this run |
|---|---|---|
| 1 | Resolve billing-gate contradiction | **Not done.** [needs-founder] — unchanged from last week. |
| 2 | Ship R1.5 verdict receipts | **Done** — PR #253 (`0e8a041`). |
| 3 | Ship R1.6 newsletter | **Done** — PR #251 (`34aef5c`) + #264/#266 hardening. |
| 4 | Reprioritize queue: funnel items outrank billing/admin/content | **Partial.** GTM items shipped, but per the business plan's own §6 order (fix funnel → community seeding → SEO mesh → agent channel), items 3 and 4 (SEO guides, `/mcp` page) shipped while item 1 (the diagnosed VerdictRail CTA funnel bug, flagged 7/10) and item 2 (community-reply drafts, sitting since 7/6) did not move. |
| 5 | Freeze admin-UI/nav-polish/content-scaling | **Admin-UI/nav: held** (no matching commits in `git log 4b104d9..HEAD` — first clean week). **Content-pipeline scaling: not held** — 5 new program guides shipped (PR #275) before the staleness guard (item 6) existed. |
| 6 | Content staleness ("verified as of") guard | **Not started** — and now overdue, since #275 shipped more content ahead of it. |
| 7 | Split `verdict_viewed` into demo vs. balance-personalized | **Not verified this run** — no lens found evidence either way. |
| 8 | Billing-gate-status line in ops-runbook.md | **Not done** — the current-state table still reads the same as last week ("ON... still owed: one real test purchase"), no explicit §3.1 four-gate cross-reference added. |
| 9 | `HOP_OWNER_EMAIL` alert on failed Stripe webhook | **Not verified this run.** |
| 10 | Fold agent-fleet compute cost into B3 panel | **Not done** — `llmCostUsd` in `lib/unit-economics.ts` is still hardcoded `null`. |
| 11 | Duffel look-to-book ratio monitoring | **Not verified this run.** |
| 12 | Ship R2.1 public `/mcp` page | **Done** — PR #280 (`9b2add9`). |
| 13 | Weekly "did any stranger use hop" report | **Not started** — same blocker as last week (retro prompt not updated). |
| 14 | Draft owner-action pack to zero-friction | Already done prior run; unchanged. |
| 15 | [needs-founder] Personally send seats.aero terms + community replies | **Seats.aero: sent**, no reply logged. **Community replies (Reddit/HN, drafted 7/6): still not sent**, six days later. |

## 3. Consensus risks (2+ members)

- **Billing is still live on an unlicensed feed with zero new evidence of a resolution path.**
  Subscription-economics, CFO, and product-skeptic all independently flag that gate ④ (seats.aero
  written terms) and gate ② (one real Stripe purchase) are unchanged from last week — verbatim
  the same unmet state, now a week older, with no reply logged from seats.aero and no escalation
  queued in Linear (N-320 still Backlog, `startedAt: null`).
- **The board's own kill-listed `/pricing` page was not frozen, reverted, or gated — and got more
  exposure this week.** Subscription-economics and product-skeptic both independently verified:
  the page is live, fully wired to real checkout when billing is on, publicizes "$49/yr" in its
  metadata unconditionally (not gated on `isBillingEnabled()`), and gained a brand-new inbound
  link from the newly-shipped `/mcp` page. Linear N-319 has sat "In Progress" for six days with
  zero commits against `app/pricing/page.tsx` since it was created (2026-07-05, pre-dating the
  kill vote) — the page isn't fresh scope creep, but the board's explicit vote to kill/freeze it
  was not acted on either.
- **The funnel's conversion floor is now a confirmed pattern, not early noise.** CFO and growth
  operator both treat `signed_up`/`first_program_added` = 0 across three consecutive reads
  (7/6, 7/8, 7/10, spanning 48→95 visitors) as a real, worsening-relative-to-traffic signal that
  should block further top-of-funnel content work until addressed — not "too early to call."
- **Content-pipeline expansion shipped ahead of its own prerequisite.** Product-skeptic and growth
  operator both flag that 5 new program guides (PR #275) shipped while the staleness/freshness
  guard the retro itself said was a precondition remains unbuilt — the freeze held for admin-UI
  but not for content scaling.
- **Finance-desk output is answering the wrong question.** CFO and subscription-economics both
  note the finance desk has spent real effort chasing free credits (Sentry, Vercel, Mercury) while
  the one question that actually matters — is there a real paying subscriber, checked against the
  DB — has never been answered ("no DB access this session" repeats across all 5 ledger entries),
  and the ledger has gone silent for 5 days as of this run.

## 4. Contested points (no false consensus)

- **Is the public `/mcp` page (R2.1) this week's best use of the GTM slot?** Travel-industry
  skeptic and the board's own prior amendment list treat it as a genuine, board-prioritized win
  worth doubling down on (submit to MCP directories next). Growth operator instead reads it as a
  queue-jump: the business plan's own §6 sequencing puts fixing the funnel and community seeding
  ahead of the SEO mesh and agent channel, and both of those higher-priority items (the diagnosed
  VerdictRail CTA bug, the drafted-but-unsent Reddit/HN posts) sat untouched while `/mcp` and 5
  program guides shipped instead. Board should decide whether GTM lever #4 is allowed to ship
  ahead of levers #1–2, or whether sequencing should be enforced.
- **Is the "strategy desk went silent" read accurate?** As corrected in §1: no — it's a genuine
  cron-ordering bug (board fires 2 hours before Marcus every Sunday), not evidence the desk
  failed. Flagging this here so it isn't re-litigated as a desk-performance issue next week before
  the schedule is actually fixed.
- **Is the seats.aero fallback-award-source risk urgent or already covered?** Travel-industry
  skeptic treats the missing fallback prototype (specced in business-plan.md's own risk table,
  "prototype one fallback award source behind `degraded[]`") as the single highest-leverage
  unaddressed item — zero lines of code exist for it. No other lens flagged this directly; the
  board should weigh whether this is this week's most urgent technical risk or a slower-burn item
  relative to the funnel-conversion problem three other lenses prioritized higher.

## 5. Kill list (board would vote for)

1. Resolve `/pricing`'s status one way or the other — either finish it properly (FAQ, JSON-LD,
   `noindex`/flag-gate until billing gates close) or revert/freeze it outright. "In Progress" with
   no commits for six days, while its metadata already publicizes a price the product can't yet
   sell, is worse than either extreme (subscription-economics, product-skeptic).
2. No further `/guides/[program]` or content-pipeline expansion until the staleness/"verified as
   of" guard exists (product-skeptic, growth operator) — this was already the retro's own
   precondition; #275 shipped ahead of it once.
3. No further `/mcp` polish (connector badges, more tool docs) until at least one MCP-directory
   submission actually exists (travel-industry skeptic) — a page without distribution is a demo.
4. Ease off the finance desk's free-credit-hunting cadence until one ledger entry reports a
   DB-verified real subscriber count, even if that count is confirmed zero (CFO,
   subscription-economics).
5. No further MCP quota/billing feature engineering until the one owed Stripe test purchase
   actually lands (carried forward from last week, still true).

## 6. Double-downs

- **Verdict receipts + newsletter** — both shipped as specced, both genuinely satisfy conditions
  toward the plan's own $99/yr raise criteria ahead of schedule (subscription-economics).
- **The VerdictRail CTA fix** — a one-file, already-diagnosed, low-risk change sitting idle since
  the 7/10 hypothesis was written; the cheapest available fix to the funnel's actual bottleneck
  (growth operator).
- **Submitting `/mcp` to 2–3 MCP directories** (PulseMCP, Smithery, mcp.so) — a day of work that
  turns this week's shipped page into an actual distribution channel (travel-industry skeptic).
- **The seats.aero fallback-award-source prototype** — the plan's own named kill-criterion
  mitigation, still unstarted, cheapest available risk reduction on the board (travel-industry
  skeptic).
- **The community-reply drafts** (Reddit/FlyerTalk, ready since 7/6) — the one growth motion with
  zero agent substitute and the longest-open clock (growth operator, carried from last week).

## 7. Ranked amendment list

1. Fix the board-review / strategy-desk cron ordering (`docs/team/routines.md`'s board trigger
   fires at `0 13 * * 0`, two hours before Marcus's `0 15 * * 0`) so this review can ever actually
   see that week's strategy output instead of structurally always reviewing stale/absent data.
   **[agents-can-execute]**
2. Resolve `/pricing`'s stalled state: finish it (FAQ/JSON-LD/nav links/`noindex` until billing
   gates close) or revert/freeze the route and flip N-319 back to Backlog to match reality.
   **[agents-can-execute]**, but the underlying "flip billing off or accept the exposure" call is
   **[needs-founder]**.
3. Ship the VerdictRail CTA fix diagnosed in the 7/10 funnel-log entry — the cheapest identified
   fix to the funnel's confirmed zero-conversion pattern. **[agents-can-execute]**
4. Add the content staleness/"verified as of" guard before any further program-guide or
   sweet-spot-page expansion (carried forward from last week, now overdue). **[agents-can-execute]**
5. Submit the shipped `/mcp` page to 2–3 MCP directories (PulseMCP, Smithery, mcp.so).
   **[agents-can-execute]**
6. Prototype one fallback award-data source behind `degraded[]`, per the business plan's own
   seats.aero risk mitigation — currently zero lines of code. **[agents-can-execute]**
7. Add a DB-verified real subscriber count (even if zero) to the next finance ledger entry before
   any further free-credit research. **[agents-can-execute]**
8. Fix GitHub Actions billing so CI stops running `workflow_dispatch`-only — over a week now with
   an unattended fleet self-certifying diffs on local checks + Vercel preview alone.
   **[needs-founder]**
9. Confirm directly whether Oliver approved the seats.aero/AwardWallet outreach sends (still no
   approval-log entry per last retro's escalation) and whether he wants `HOP_ENABLE_BILLING`
   flipped off given a week of unmet gates. **[needs-founder]**
10. Decide whether to post the drafted Reddit/HN community replies this week, or explicitly pause
    that motion — they've sat ready since 2026-07-06 with no agent substitute possible.
    **[needs-founder]**
11. Add referrer/source-split data to the funnel log before drawing further conclusions from the
    rising-visitor trend (could be SEO-indexing noise, not real top-of-funnel interest).
    **[agents-can-execute]**
12. Add a billing-gate-status line to `docs/ops-runbook.md` that explicitly cross-references
    business-plan.md §3.1's four gates met/unmet (carried forward, still not done).
    **[agents-can-execute]**
13. Fold agent-fleet compute cost into the B3 unit-economics panel — `llmCostUsd` is still
    hardcoded `null` (carried forward). **[agents-can-execute]**

## 8. Questions for the founder (verbatim)

1. "Billing has now been live on an unlicensed seats.aero feed for over a week with zero
   purchases and zero reply to your own commercial-terms email, and the exact page your own board
   voted to kill last week not only stayed up but gained a brand-new public inbound link from the
   `/mcp` page this week — do you want `HOP_ENABLE_BILLING` off today, or are you consciously
   accepting the seats.aero legal exposure indefinitely with no one checking in on it?"

2. "You shipped a public `/mcp` landing page this week but not the directory submissions that
   would make anyone besides someone who already knows your domain name find it, and you still
   haven't prototyped the one fallback award source your own plan calls the kill-criterion for the
   seats.aero risk — is that a deliberate 'demo surface first' sequencing choice, or did the queue
   just pick the page because it was easier than the fallback?"

3. "Given billing can't legally flip until you personally close the seats.aero commercial-terms
   conversation (N-320), and CI has been broken on your account's payment method for over a week —
   are you going to do either of those two owner-only actions this week, or should the fleet stop
   planning around an August 5 revenue date that only you can unblock?"

4. "The Reddit and HN drafts have sat ready-to-post since July 6 waiting on your account — should
   I treat community seeding as paused indefinitely, or will you post these this week?"

5. "N-319 has been 'In Progress' for six days with no commits against it while its live route
   already publicizes the $49/yr price in page metadata — do you want it finished, frozen, or
   reverted, and does the board's kill-list vote on `/pricing` still stand now that billing gates
   remain unmet?"
