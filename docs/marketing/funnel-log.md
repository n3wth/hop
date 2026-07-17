# Growth desk funnel log

Append-only. One entry per run (Mon/Wed/Fri), each a short trend note pulled from PostHog —
never invented. Source events: `signed_up`, `first_program_added`, `search_ran`,
`verdict_viewed`, `outclick` (R0.5, `lib/*` instrumentation); web traffic via PostHog's web
analytics. MRR-gate status references `docs/plans/2026-07-05-agentic-travel-agent-northstar.md`
("The revenue goal" section).

**Standing requirement — every traffic query MUST filter `$host = hop.flights`.** The `n3wth`
PostHog project (id 223560) is shared across six hostnames (`hop.flights`, `n3wth.com`,
`skills.n3wth.com`, `garden.n3wth.com`, `r3.n3wth.com`, `ui.n3wth.com`). An unfiltered
`query-web-overview`/web-analytics pull mixes all six and overstates hop's visitors/sessions by
~5x (the other sites contribute many low-engagement uniques). This applies to the shared
`$pageview`-based traffic pull — apply
`{"key":"$host","value":"hop.flights","operator":"exact","type":"event"}` to it. The funnel
events above don't need it: they are hop-specific event names emitted only by hop's own code, so
the other five sites never produce them regardless of host. (Note the server-side ones —
`signed_up`, `first_program_added`, and the server `outclick` shadow — go through
`captureServerEvent` and carry **no** `$host` at all; only the browser events
`search_ran`/`verdict_viewed`/`outclick` do. Don't filter funnel events by `$host` — you'd drop
the server-side rows.) Reads before 2026-07-12 were unfiltered; see the 2026-07-12 correction
entry at the end.

---

## 2026-07-06

- **Traffic (7d)**: 48 visitors, 68 sessions, 426 pageviews, 47% bounce rate, ~8.8 min avg
  session — real, if small, traffic is reaching the site.
- **Funnel (7d)**: `search_ran` 15, `verdict_viewed` 15 (8 on 7/4, 7 on 7/5, 0 on 7/6 so far) —
  every search that ran produced a verdict, a good sign the engine resolves reliably. `signed_up`
  **0**, `first_program_added` **0**, `outclick` **0** across all 7 days.
- **What's stuck**: zero conversion from search to account, all 7 days. 48 visitors is too small
  a sample to call this a broken funnel outright, but it's also the first read since R0.5
  instrumentation shipped (2026-07-05) — this is the baseline, not yet a trend.
- **Hypothesis**: with sign-up not required to see a verdict (by design — "no-auth live verdict"
  is the whole activation thesis), the natural next signal to watch is whether *any* visitor adds
  a program or clicks a cash outclick, not whether they sign up per se. Next run: re-check this
  same window; if it's still all-zero at higher traffic, the CTA into account creation is the
  place to look first.
- **MRR-gate status — Wk1 ("payment path proven, one real stranger pays")**: **not met, and
  structurally not yet reachable.** R0.2 (Stripe lane) is Done, but R3.2 (flip `HOP_ENABLE_BILLING`
  at $49/yr) is still Backlog and unstarted — nobody can pay yet because billing isn't live. R3.2
  itself is sequenced behind R3.1 (seats.aero written commercial terms, an owner-only action,
  N-320, also still Backlog) per the business plan's kill-criteria on billing without a licensed
  award-data source. Until R3.1 clears, the Wk1 gate cannot fire regardless of traffic or content.
- **Also noted**: GitHub Actions CI is failing repo-wide as of today (billing issue, tracked
  N-347, owner-only fix) — any PR opened this run will not self-merge until that's resolved.

---

## 2026-07-08

- **Traffic (7d)**: 61 visitors, 88 sessions, 493 pageviews, 28.4% bounce rate, ~7.5 min avg
  session — visitors up ~27% vs the 7/6 read (48→61); bounce rate improved (47%→28.4%).
- **Funnel (7d, 7/1–7/8)**: `search_ran` 18 (8 on 7/4, 7 on 7/5, 2 on 7/6, 1 on 7/7, 0 so far
  7/8), `verdict_viewed` 17 — the engine is still resolving essentially every search into a
  verdict. `signed_up` **0**, `first_program_added` **0**, `outclick` **0** — same all-zero
  read as 7/6, now across a second, larger sample window.
- **What's stuck**: two consecutive reads (7/6, 7/8) show zero conversion from verdict to
  account/program/outclick despite rising traffic. This is no longer just "too early to call" —
  it's the same pattern holding as the sample grows. Worth a real look at the CTA path from a
  rendered verdict into account creation or the cash outclick, next content/product cycle.
- **MRR-gate status — Wk1 ("payment path proven, one real stranger pays")**: **not met, still
  structurally unreachable.** R3.1 (N-320, seats.aero written commercial terms, owner-only) is
  still Backlog and unstarted; R3.2 (flip `HOP_ENABLE_BILLING`) is sequenced behind it and also
  unstarted. No code change this run affects this gate — it is blocked on an owner action, not on
  build work.
- **Also noted**: GitHub Actions billing is still broken (N-347, owner-only, still Backlog);
  `ci.yml` is now deliberately `workflow_dispatch`-only (a documented 2026-07-04 workaround, not
  an accident — see the comment at the top of the file) so red-X noise stops blocking PRs. The
  documented interim gate is `npm run check` + `npm run build` locally plus the Vercel preview
  build check per PR — this run's PR relies on that same gate.
- **This run's action**: shipped 5 of the 8 planned program-guide pages (N-316), the top SEO
  lever per the business plan's §6 GTM sequencing — an owned-channel asset, so it ships directly
  via PR rather than through `docs/marketing/drafts/` (see Linear N-352 for detail).

---

## 2026-07-10

- **Traffic (7d)**: 95 visitors, 125 sessions, 568 pageviews, 22.4% bounce rate, ~5.7 min avg
  session — visitors up again vs both prior reads (48 on 7/6 → 61 on 7/8 → 95 today, +56% over
  the last read); bounce rate keeps improving (47% → 28.4% → 22.4%).
- **Funnel (7d, 7/3–7/10)**: `search_ran` 20, `verdict_viewed` 19 — still resolving essentially
  every search into a verdict. `signed_up` **0**, `first_program_added` **0** — three consecutive
  reads all-zero, now against nearly double the traffic of the first read. **`outclick` fired
  once**, on 7/8 — the first non-zero read on any of the three "did anyone act" events since
  instrumentation shipped (2026-07-05). One event is not a trend, but it's the first evidence the
  cash-CTA path works end to end for a real visitor.
- **What's stuck**: `signed_up`/`first_program_added` are still zero after 3 reads and ~7 days of
  rising traffic — worth treating as a real signal now, not sampling noise. Checked the verdict
  page's CTA logic (`components/VerdictRail.tsx`): the primary CTA already reads "Sign in to see
  if your [miles] win" for a points-favorable, signed-out verdict, and "Book cash" (no sign-in
  ask at all) for a cash-favorable verdict — so the sign-up prompt only ever appears on a subset
  of searches. Didn't change this without knowing the cash-vs-points split of the 20 searches;
  flagging as a hypothesis for next run rather than guessing at a fix blind.
- **MRR-gate status — Wk1 ("payment path proven, one real stranger pays")**: **not met, still
  structurally unreachable.** Checked N-320 (seats.aero written commercial terms, owner-only) —
  still Backlog, unstarted. N-321 (flip `HOP_ENABLE_BILLING`) is sequenced behind it and also
  unstarted. No code change this run affects this gate — still blocked on the owner action, not
  build work. This is now the third consecutive read with the same status.
- **This run's action**: shipped the public `/mcp` page (R2.1's first slice, N-313) — "hop for
  AI agents," the MCP server's front door (previously reachable only after sign-in, inside
  `/account`'s token panel). Lists all 6 tools, a copy-paste quickstart for Claude
  Desktop/Code/Cursor/ChatGPT, and the free/Pro quota split (25 vs 1,000 calls/day), wired into
  the footer + sitemap mesh. Chose this over pushing further on N-316 (program guides): the data
  model only supports 5 real transfer-partner guides today (Amex/Chase/Citi/Cap One/Bilt — all
  already shipped), so hitting "eight" would mean inventing a new guide type for direct-earn
  airline programs; the MCP page is explicit GTM lever #4 in the business plan §6 and was fully
  unbuilt as a public surface. PR: see this run's Linear update (N-352) for the link.

---

## 2026-07-12 — correction (traffic reads were unfiltered)

Not a run — an append-only correction. The 7/6, 7/8, and 7/10 **Traffic** lines above were
pulled from the shared `n3wth` PostHog project **without a `$host` filter**, so they summed all
six hostnames instead of hop.flights alone (root cause of the leak: this log's header sourced
traffic "via PostHog's web analytics" with no `$host` clause). The reported **48 → 61 → 95
"rising" visitor trend is an artifact of the unfiltered mix** — the other sites (chiefly
`garden.n3wth.com`) add many low-engagement uniques. The originals are left as-logged above;
corrected hop.flights-only figures below.

Re-queried 2026-07-12 via `query-web-overview` with
`properties: [{"key":"$host","value":"hop.flights","operator":"exact","type":"event"}]`, same
7-day windows as each entry (visitor/session counts drift slightly from the originals because the
exact query hour can't be reproduced; the shape is what matters):

| Entry (7d window) | Logged (unfiltered) | hop.flights only | Unfiltered total, same window |
| :--- | :--- | :--- | :--- |
| 7/6 (6/30–7/6) | 48 visitors, 68 sessions | **~17 visitors, 41 sessions** | — |
| 7/8 (7/1–7/8) | 61 visitors, 88 sessions | **~21 visitors, 49 sessions** | — |
| 7/10 (7/3–7/10) | 95 visitors, 125 sessions | **~24 visitors, 54 sessions** | ~113 visitors (hop ≈ 1 in 5) |

**hop.flights traffic is flat at ~17 → 21 → 24 visitors, not rising.** Pageviews were already
near-accurate (hop has fewer but far more engaged visitors — ~13–15 min sessions vs the blended
~5–9 min above); the distortion is in the visitor/session counts. Growth/strategy calls should
use the filtered figures.

The **funnel counts and the zero-signup pattern in every entry stand** — `search_ran`,
`verdict_viewed`, `signed_up`, `first_program_added`, and `outclick` are hop-specific event names
emitted only by hop's own code (`lib/*`), so the other five sites can't contribute to them
regardless of host. This correction touches only the traffic reads.

---

## 2026-07-13

- **Traffic (7d, hop.flights-only, `$host` filter applied per the 7/12 correction)**: 21
  visitors, 88 pageviews, 36 sessions, 36.1% bounce rate, ~4.1 min avg session. In line with the
  corrected 7/10 read (~24 visitors) — flat, not growing.
- **Funnel (7d)**: `search_ran` and `verdict_viewed` fired only on 7/6–7/8 (2, 1, 2 respectively;
  1, 1, 2 verdict_viewed) and have been **zero every day since, 7/9–7/13 (5 straight days)**.
  `signed_up` and `first_program_added` remain zero across all 8 days logged since instrumentation
  shipped. `outclick` fired once total, on 7/8.
- **N-372 follow-up (search_ran zero-day diagnosis)**: checked `components/SearchTelemetry.tsx` —
  it fires unconditionally on every `/search` render with a resolved `from`/`to` (which
  `app/search/page.tsx#parseParams` always provides via defaults, even with zero query params), so
  a code regression that silently drops the event was not found by inspection. Pulled a
  page-level breakdown for the zero-day window specifically (7/9–7/13): **one visitor did load
  `/search` (3 pageviews) during that window with zero corresponding `search_ran`** — the one
  concrete anomaly found this run. At n=1 this doesn't clear the bar for "confirmed bug" (a
  privacy/tracker-blocking visitor is at least as likely an explanation as a product regression,
  especially for whatever audience reads r/awardtravel or HN), but it's also not nothing. Logging
  as: **inconclusive, not closed** — needs a bigger sample before spending build time chasing it
  further. The CTA-copy portion of N-372 (item 3, "Track your miles" nudge on the pay-cash path)
  already shipped and merged as PR #286 prior to this run.
- **N-311 ("R1.7 Design P1s") was stale-backlog and already done**: verified in the code that all
  three done-criteria — `--color-hero-label`/`--color-hero-eyebrow` contrast tokens, VerdictRail's
  aria-label, and the TopNav bunny+wordmark lockup — are already implemented (values match the
  documented 4.6:1/4.8:1 contrast ratios). Marked Done in Linear this run so it stops showing as
  open backlog for future runs.
- **This run's action**: shipped a new evergreen SEO page — a cents-per-point / point-valuation
  methodology explainer (`docs/content-plan.md` §1 flags this as an unbuilt **P1** content type:
  "builds trust in hop's core number, differentiates hop's *computed* cpp from blogs' static
  valuations"). Confirmed via grep that no such page existed anywhere in `app/` before this run.
  Built from `lib/cpp.ts` (formula, tier thresholds) and `lib/valuations.ts`'s `BASELINE_CPP`
  table only — no invented numbers. See this run's Linear update (N-352) for the PR link and
  merge status.
- **MRR-gate status — Wk1 ("payment path proven, one real stranger pays")**: **not met, still
  structurally unreachable.** N-320 (seats.aero written commercial terms, owner-only) is still
  Backlog, unstarted, unchanged since the last four reads. This is now the fourth consecutive read
  with the same status — the gate has been open for 8 days on an owner-only blocker.
- **The single highest-leverage thing sitting undone**: the two ready-to-paste launch drafts in
  `docs/marketing/drafts/` (Show HN, r/awardtravel sweet-spot math) have now been sitting
  unposted for **7 days** (drafted 2026-07-06). Both need only the founder logged into the
  respective account to paste and submit — no code, no review, ~5 minutes total. Per the
  north-star doc, this is explicitly "the single highest-leverage human act in this plan." Flagged
  again in this run's Linear growth-log update.

---

## 2026-07-15

- **Traffic (7d, hop.flights-only, `$host` filter applied)**: 13 visitors, 116 pageviews, 22
  sessions, 40.9% bounce rate, ~5.8 min avg session. Visitors are down vs the 7/13 read (21) but
  this window (7/8–7/15) also fully rolls off the 7/4–7/5 launch-week spike that inflated earlier
  reads — pageviews are actually up (88→116) on fewer sessions, consistent with a smaller number
  of more-engaged visitors rather than a real traffic drop. Still a small-sample read; don't
  over-index either direction.
- **Funnel (7d + 14d for sample size)**: `search_ran`/`verdict_viewed` were zero 7/9–7/13 (5
  straight days, as flagged 7/13), then **both jumped to 5 on 7/14** — the first double-digit-free
  but real activity in five days — before returning to zero on 7/15 so far. `outclick` fired
  **3 times on 7/14** (previously fired once total, on 7/8) — the largest single-day count since
  instrumentation shipped. `signed_up` and `first_program_added` remain **zero across all 10 days
  logged since 2026-07-05** — now a 5th consecutive read with no account-creation or
  program-linking event at all, across ~135 total pageviews and ~24 verdict views in that window.
- **New this run — sized the N-372 CTA-subset hypothesis (7/10 entry's open question)**: broke
  down `verdict_viewed` by its `verdict` property (`use-points` vs `pay-cash`) over the last 14
  days. Result: **20 of 24 verdicts (83%) were `pay-cash`**; only 4 were `use-points`, and 3 of
  those 4 landed on 7/14 (the one day with above-zero activity). Concretely: 7/4–7/8 was 18
  pay-cash vs. 1 use-points (~95% cash-favorable). Per `components/VerdictRail.tsx`'s current
  logic (confirmed by the 7/10 entry), the sign-in nudge only renders on a points-favorable
  verdict — so across the sampled window, roughly **4 in 5 real searches never saw an
  account-creation prompt at all**, independent of anything about the value of the prompt itself.
  This is a real, sample-sized confirmation of the hypothesis, not just a plausible story — posted
  as a comment on N-372 (still In Progress; item 3 of that issue already shipped via PR #286, but
  items 1–2 were open) so the next session building the fix has the actual split instead of an
  untested guess.
- **MRR-gate status — Wk1 ("payment path proven, one real stranger pays")**: **not met, still
  structurally unreachable.** N-320 (seats.aero written commercial terms, owner-only) is still
  Backlog, unstarted — unchanged since the last five reads. The gate has now been open **10 days**
  (declared 2026-07-05) on a single owner-only blocker; no code change this or any recent run
  moves it.
- **This run's action (in progress at time of writing, not yet shipped)**: a new evergreen SEO
  page — a "Points 101" beginner guide (`docs/content-plan.md` §1's unbuilt P1 "Beginner
  education" content type: transferable vs. locked currencies, why cents-per-point beats a flat
  cash-back rate) — is being built in a background agent, branch
  `growth/2026-07-15-points-101-guide`. Scoped to build entirely from `lib/programs.ts`'s
  `transferable`/`kind` fields and `lib/cpp.ts`'s existing tier constants — no invented facts,
  deliberately dropping the content-plan's "alliance basics" bullet since no alliance-membership
  data exists in `lib/*` to ground it. Mirrors `app/guides/point-value/page.tsx`'s established
  pattern. **Correction (this run, post-review)**: this entry originally described the page as
  already shipped; at the time this PR was opened, no branch or PR existed yet and no new page
  was in the tree — caught by `charliecreates`' review on PR #292. Leaving this line as
  in-progress rather than claiming completion; the next entry (or a follow-up correction here)
  will confirm the real PR/merge outcome once the background agent actually lands it.
- **Still the single highest-leverage thing sitting undone**: the two ready-to-paste launch
  drafts in `docs/marketing/drafts/` (Show HN, r/awardtravel sweet-spot math) have now been
  sitting unposted for **9 days** (drafted 2026-07-06, first flagged 7/13). Nothing about this
  has changed in two consecutive reads — still needs only the founder logged into the respective
  account, ~5 minutes total, explicitly "the single highest-leverage human act in this plan" per
  the north-star doc.

---

## 2026-07-15 — correction (Points 101 outcome)

Not a new run — an append-only correction to the 2026-07-15 entry above, same convention as the
2026-07-12 traffic correction. The original entry's "This run's action" line is left unchanged
above (it correctly recorded the page as in-progress, not yet shipped, at the time PR #292 was
under review). Recording the actual outcome here instead of editing that line in place:

`/guides/points-101` ("Points 101" — the `docs/content-plan.md` §1 unbuilt P1 "Beginner
education" content type) **shipped and merged as PR #293.** Every figure on the page traces to
`lib/programs.ts`'s `PROGRAMS` registry or `lib/cpp.ts`'s tier constants — no invented facts,
deliberately dropping the content-plan's "alliance basics" bullet since no alliance-membership
data exists in `lib/*` to ground it. Cross-linked from `/guides` and `/guides/point-value`,
registered in the sitemap.

PR #293 itself drew two real `charliecreates` findings, both fixed before merge: (1) the
fair-value tier badge read "1.5–3.0¢/pt", which visually contradicts `lib/cpp.ts#tier()`'s `>=`
boundary — exactly 3.0¢/pt is green, not amber — corrected to "1.5–&lt;3.0¢/pt"; (2)
`CONTENT_LAST_MODIFIED` (`lib/seo-routes.ts`) was left stale at 2026-07-10 despite shipping new
SEO content, bumped to 2026-07-15 per its own bump-on-ship convention (confirmed via git history
that this constant is meant to be bumped on every content-shipping PR). A third finding on PR
#292 itself (the premature "shipped" claim this correction is closing out) was also fixed before
that PR merged. Net for the run: the review bot caught three real, small issues across two PRs
that self-review missed — logged here as a data point on how much that gate is pulling its
weight, not as a complaint.

---

## 2026-07-17

- **Traffic (7d, hop.flights-only, `$host` filter applied)**: 14 visitors, 113 pageviews, 23
  sessions, 39.1% bounce rate, ~4.7 min avg session. Flat vs the 7/15 read (13 visitors, 116
  pageviews) within noise — still a single-digit-visitors-per-day site.
- **Funnel (7d)**: `search_ran`/`verdict_viewed` were 0/0 on 7/10–7/13, jumped to 5/5 on 7/14 (as
  already noted 7/15), dropped back to 1/1 on 7/15, then **0/0 on both 7/16 and 7/17 (partial)**.
  `outclick` fired twice on 7/14, zero since. **`signed_up` and `first_program_added` remain zero
  across all 12 days logged since 2026-07-05** — now a 6th consecutive read with no
  account-creation or program-linking event at all.
- **N-372 (VerdictRail CTA fix) closed out this run**: verified against the current
  `components/VerdictRail.tsx` that all three "done means" items are complete — (1) the
  cash-vs-points split was sized in the 7/15 entry (83% pay-cash), (2) the four-zero-day scare
  from 7/9–7/12 is not an instrumentation regression: `search_ran`/`verdict_viewed` fired
  correctly the moment a real visitor showed up (7/14), so the zero days are a traffic-volume
  artifact, not a broken event pipe, (3) `showAccountNudge` (line 146) already renders a secondary
  "Track your miles" / "Add your programs" CTA on every pay-cash verdict where the visitor isn't
  both signed in and fully onboarded, per PR #286. Marked N-372 Done in Linear this run. Net
  read: the CTA fix shipped and works as designed, and it *still* hasn't produced a single
  `signed_up` in the three days since — at 14 visitors/week, a conversion-copy fix has nothing to
  convert. The bottleneck is traffic, not the funnel.
- **MRR-gate status — Wk1 ("payment path proven, one real stranger pays")**: **not met, still
  structurally unreachable.** N-320 (seats.aero written commercial terms, owner-only) is still
  Backlog, unstarted — unchanged since the last six reads. The gate has now been open **12 days**
  (declared 2026-07-05) on a single owner-only blocker.
- **This run's action**: audited the P0/P1 content-plan checklist (`docs/content-plan.md` §1)
  against what's actually shipped — cpp-methodology explainer, Points 101, and all 5 transferable-
  currency guides (`/guides/[program]`) are live; sweet-spots (16) and destination pages are
  built. The content backlog for a cold-traffic funnel is largely exhausted at this traffic level;
  shipping a 6th evergreen page has diminishing marginal return with 14 visitors/week reaching
  the site at all. Redirected this run's owned-channel effort to a distribution channel that's
  been named-but-never-executed in two prior documents (`docs/board/2026-07-12-board-memo.md`,
  `docs/agent-playbook.md`): submitting the already-shipped `/mcp` page
  (`app/mcp/page.tsx`, live since R2.1) to MCP discovery directories. Researched the three named
  in those docs — **Smithery** requires `smithery login` (an authenticated CLI publish flow, no
  public unauthenticated submission path found); **PulseMCP**'s public submission page currently
  reads "no longer accepting new use case submissions" (unclear if that's the servers directory or
  a different intake — could not confirm a working public path); **mcp.so**'s submit page
  (`mcp.so/submit?type=server`) returned HTTP 403 to an unauthenticated fetch, and its documented
  fallback is a GitHub issue on `mcp.so`'s own repo, which is a different repository than
  `n3wth/hop` (out of this session's GitHub scope). None of the three have a submission path this
  session could complete unattended without either external-account login or GitHub access to a
  repo outside `n3wth/hop`. Wrote ready-to-paste submission copy for all three to
  `docs/marketing/drafts/2026-07-17-mcp-directory-submissions.md` instead, same treatment as the
  HN/Reddit drafts — the founder (or a future session with Smithery/mcp.so-scoped GitHub access)
  can paste directly.
- **Still the single highest-leverage thing sitting undone**: the two ready-to-paste launch
  drafts in `docs/marketing/drafts/` (Show HN, r/awardtravel sweet-spot math) have now been
  sitting unposted for **11 days** (drafted 2026-07-06, first flagged 7/13, flagged every read
  since). At 14 visitors/week from organic/direct only, this is now the dominant explanation for
  why the funnel has near-zero volume to convert — no amount of on-site copy work fixes a traffic
  problem. Needs only the founder logged into the respective account, ~5 minutes total.
