# hop weekly strategy review — 2026-08-09

Marcus, strategy desk. **Baseline**: `docs/board/2026-08-09-board-memo.md`, dated today — a real,
thorough five-lens adversarial pass, but **not yet merged** (open draft PR #411, opened 13:16 UTC
today, ~2 hours before this run). Per the same institutional-memory pattern flagged the last two
consecutive weeks (`docs/agent-playbook.md`'s 2026-08-02 caveat: "do not treat a board memo's own
prose as proof its content reached `main`"), this review did not take the memo's text on faith —
every load-bearing claim below was re-verified independently this run: a live GitHub PR pull
(`#373` age, `#409` age, open-PR count), a live Linear pull (N-320, N-386, N-395/N-396 status), a
fresh PostHog pull (traffic + funnel, `$host`/`$virt_traffic_type`-filtered per the funnel-log's
standing rules), and a fresh ~25-minute Exa market scan the board memo itself doesn't run. Every
number matched the board's draft exactly (PR #373: 11 days, created 2026-07-29T21:13Z; PR #409: 2
days, created 2026-08-07T15:18Z; N-320: 34 days silent, `Backlog`/`startedAt: null`) — nothing
below contradicts PR #411; this review adopts its ranking, adds independent confirmation, and
layers in this week's market read (§c) plus one piece of new competitive sharpening (§d).

## (a) What's working

- **The merge pipeline is genuinely healthy** — confirmed via `git log`: 44 commits landed on
  `main` in the 7 days since the last board memo merged (through 2026-08-07's `aba8e7c`), and only
  two PRs are open right now (`#409`, `#411` itself), both correctly held for founder review, not
  stuck. This is real and worth naming plainly after three straight weeks of pipeline problems.
- **The observed-cpp valuation-sync pipeline is now definitively confirmed live**, not just
  probably live — the board's own direct production `curl` this run (`hop.flights/api/stats` →
  `200 {"verifiedPrograms":14,"totalPrograms":34,...}`) plus two freshly auto-filed Linear
  health-sentinel tickets (N-398, N-399, dated 2026-08-08/09) settle last week's contested
  question. This is real, unshipped differentiation sitting idle — see §(d) amendment #5.
- **Search → verdict resolution continues working at the same low baseline this week**: this
  run's own PostHog pull (7d, `$host=hop.flights`) shows `search_ran`/`verdict_viewed` both at 11,
  100% `Regular` traffic on every day with volume (8/4, 8/6, 8/7) — consistent with the funnel-log's
  8/7 entry. The engine itself is not the problem.
- **`lib/pricing.ts`'s single-source-of-truth pattern and the `isBillingEnabled()`/
  `isCheckoutEnabled()` gating** — reconfirmed clean by the board's subscription-economics lens
  this week, no drift. The code is not what's stuck; the policy decision sitting on top of it is.

## (b) What's stalled

- **Governance, not pipeline, is now the blocker.** PR #373 (revert the ADR-0009 violation, decide
  `Auto-merge` on/off) is **11 days open**, up from 4 last week — independently confirmed via
  `list_pull_requests` this run (created 2026-07-29T21:13Z). Nine automated bot nag-comments,
  zero founder replies, per the board's read of the thread.
- **PR #409 (the MCP registry submission) has sat unreviewed 2 days** — independently confirmed
  (created 2026-08-07T15:18Z). No external account, no legal judgment, one merge click,
  self-activating the moment it lands. See §(d) — this week's market scan sharpens exactly why
  this one is now time-sensitive, not just cheap.
- **N-386 (fallback award-data-source prototype) is still zero code, 21 days, 5th consecutive
  weekly memo naming it the cheapest non-founder-blocked de-risking move on the board** —
  independently confirmed via Linear (`Backlog`, `startedAt: null`, unchanged).
- **N-395/N-396 (duplicate tickets for the observed-cpp public page) are both still `Backlog`,
  zero code, 7 days after their stated blocker (merge pipeline) cleared** — confirmed via Linear
  this run. The data is live (§a); nothing is shipped off it.
- **Design-system PR creation violated the board's freeze for a second consecutive week**: 24 of
  44 commits merged since 08-02 (54%) were Card/Eyebrow/Field primitive migrations, against a
  freeze voted twice (07-26, 08-02).
- **N-320 (seats.aero) is 34 days silent** — independently recomputed from `outreach.md`'s own
  2026-07-06 sent-date, matching the board's figure exactly. `HOP_ENABLE_BILLING` remains on
  against that same unlicensed, actively-shipping feed.
- **Traffic (7d, `$host=hop.flights`, `filterTestAccounts: true`, pulled fresh this run)**: 14
  visitors, 63 views, 19 sessions, 349s avg session, 26.3% bounce. Matches the 8/7 funnel-log read
  almost exactly — still flat at the same single-digit-to-low-teens baseline the site has held
  since traffic peaked around 7/10 and declined through every read since, now 5 weeks running.
  `signed_up`/`first_program_added`: zero for confirmed-`Regular` traffic this window (the one
  8/5 `signed_up` event is, again, 100% `Automation` — already caught and downgraded in the 8/7
  funnel-log entry, reconfirmed, not new). Zero confirmed-`Regular` outclicks continue.
- **The 2026-08-05 $10k MRR target has been expired and unqualified in `docs/agent-playbook.md`
  for 4 days** — the date has passed at $0 realized revenue; the file every new session reads
  first still states it as live with no correction.

## (c) Competitive / market read this week

~25 min via Exa. Less material than the last two weeks — no single new devaluation, launch, or
feature shift on the scale of the Gondola-maturation or seats.aero-Chrome-extension finds from
prior reads. The story this week is less "what changed" and more "the gap between hop's shipping
cadence and the field's is now visible in a single concrete artifact" — see §(d).

- **Seats.aero — hop's own data landlord — shows no new product news since the last read**, but
  everything found in the 7/20–7/29 window (the Chrome extension, the redesigned search UI, United/
  Delta cardholder pricing, the three premium-cabin finder tools) is still live and being actively
  used/reviewed (Miles to Memories' 2026-08-06 roundup discusses it as a daily-driver tool
  alongside point.me and PointsPath). The absence of new features this specific week doesn't change
  the underlying fact: the outreach email requesting commercial terms is now **34 days** unanswered
  against a supplier that has shipped five distinct feature releases in the same window.
- **point.me continues shipping, not resting on its July TPG-partnership bump**: Miles to Memories
  (2026-08-06) reports point.me added **map area pricing, points-balance valuations, and
  side-by-side flight comparisons** this week — incremental but real product velocity on top of
  July's Explore 2.0/multicity/wallet-integration launch
  ([Miles to Memories](https://milestomemories.com/mtm-travel-august-6-2026/),
  [TPG](https://thepointsguy.com/news/point-me-new-features/)). point.me's "My Points" wallet
  feature (real-time balance-aware search) is the same balances-aware-search space hop occupies —
  reconfirms last week's read that balance-awareness is table stakes, not a hop differentiator.
- **Gondola MCP has one concrete, dated fact worth flagging plainly**: its GitHub repo and Glama
  listing show it already holds a registered server id on the **Official MCP Registry**
  (`ai.gondola/gondola`), also listed on PulseMCP and Smithery, "Healthy" status last tested
  2026-08-06 ([gondola.ai/mcp](https://www.gondola.ai/mcp),
  [GitHub](https://github.com/gondola-ai/gondola-mcp)). hop's own equivalent submission — PR #409,
  built and ready, same registry — has sat unmerged 2 days. This is the single most concrete,
  dated, falsifiable competitive fact from this week's scan: a smaller, less-established competitor
  (6-7 GitHub stars) is already discoverable in the exact registry hop's own listing is one merge
  click away from reaching. This directly sharpens board amendment #2 — see §(d).
- **No new devaluation event found this week** beyond what's already logged (Amex Netherlands
  Flying Blue, Chase Hyatt 4:3 tiering, Citi Emirates -20%, all dated 7/26–7/27 and already in the
  8/02 read). The devaluation wave documented over the last month continues to be the operative
  context, not a new data point — restating rather than re-citing as new.
- **Community sentiment**: no independently notable r/awardtravel or FlyerTalk signal surfaced in
  this run's scan specifically (as distinct from the aggregator/blog coverage above) — flagging the
  absence rather than manufacturing a finding; a future run with direct Reddit/FlyerTalk access
  would be a better instrument for this than a general web search.

**Net read**: nothing this week overturns any prior finding or changes the ranked priority order
on its own. The one genuinely new, actionable fact — Gondola already holding a live registry slot
hop's own submission is one review away from matching — is a sharpening of an existing board item
(#2), not a new item.

## (d) Reprioritization for the coming week

**Adopting the 2026-08-09 board memo's ranked list (`docs/board/2026-08-09-board-memo.md` §7, read
from unmerged PR #411) as this week's baseline, unchanged in order** — this run's independent
verification (GitHub, Linear, PostHog, market scan) confirms every load-bearing claim rather than
contradicting any of them. **No independent reordering**; the one addition is evidence-based
sharpening of the board's own #2, not a new ranking:

1. Resolve PR #373 (merge — restore `Auto-merge: off`, revert the ADR-0009 violation — or close
   with a recorded founder decision) — 11 days open, worse than last week's 4. **[needs-founder]**.
2. **Merge or close PR #409 (MCP registry listing) — sharpened this run**: the board named it the
   board's cheapest, lowest-friction ask; this week's market scan adds the concrete reason it's
   also time-sensitive, not just cheap — a smaller, less-established competitor (Gondola MCP, 6-7
   GitHub stars) already holds a live server id on the same Official MCP Registry hop's PR #409
   would register hop into. Every day #409 sits unmerged is a day hop is the *later* entrant into a
   discovery surface it built the listing for a week and a half ago. **[needs-founder]**.
3. Reply to seats.aero (N-320) or explicitly flip `HOP_ENABLE_BILLING` off — 34 days silent, the
   oldest and hardest blocker on the board, gating billing legitimacy, the (already-expired) MRR
   target, and the raise-gate simultaneously. **[needs-founder]**.
4. Correct `docs/agent-playbook.md`'s "## The goal" section — the 2026-08-05 target expired 4 days
   ago at $0 realized revenue; the file every session reads first still states it as live.
   **[agents-can-execute]** — see the playbook update shipped alongside this review.
5. Ship the observed-cpp public page (dedupe N-395/N-396 first) — the contested "is it live"
   question is now definitively resolved (production `curl`, live health-sentinel tickets), the
   stated blocker (merge pipeline) cleared 9 days ago, nothing stands between decided and shipped.
   **[agents-can-execute]**.

Items 6-15 (build N-386; reconcile the ops-runbook/budget.md billing-status contradiction; post
the 3 ready-to-paste drafts; decide on the board/strategy cadence itself; suspend or re-resource
the finance desk; fix `llmCostUsd`; reduce the bot nag-comment pattern; fix the cron ordering) carry
forward from the board's list unchanged — this run found no new evidence that would move any of
them up or down. **Explicitly not reshuffling for the sake of reshuffling**: where the board's own
ranking already reflects this week's ground truth, restating it is more useful than inventing a
reason to differ from it.

## (e) Explicit deprioritization this week

**Unchanged from the board's own kill list, restated because it's still being violated, not
because it's new**: further design-system component migration stays below N-386, the observed-cpp
page, and PR #373/#409 resolution, for as long as those sit undone — 54% of this week's entire
merge volume went to exactly the category the board voted to freeze twice. This is not a new call;
it is flagging that the existing call is still not landing in practice.

**Also carrying forward, not re-deciding**: the board's own §4 contested question of whether the
weekly board+strategy dual cadence should itself compress is a founder decision (per the board's
own framing), not something this desk should resolve by unilaterally changing its own cadence —
noting it here rather than acting on it.

## MRR-gate status

Wk1 gate ("payment path proven, one real stranger pays") is **not met, and the declared 30-day
northstar window itself closed 5 days ago (2026-08-04) at $0 realized revenue.** N-320 unstarted 34
days; zero confirmed-`Regular` conversions across every day logged since 2026-07-05 (35 days now,
reconfirmed by this run's own PostHog pull). This is no longer a forward-looking risk to flag — it
is a past deadline this desk does not have the authority to reset, sitting stated as a live goal in
`docs/agent-playbook.md` as of this run. See §(d) amendment #4.
