# Growth desk funnel log

Append-only. One entry per run (Mon/Wed/Fri), each a short trend note pulled from PostHog —
never invented. Source events: `signed_up`, `first_program_added`, `search_ran`,
`verdict_viewed`, `outclick` (R0.5, `lib/*` instrumentation); web traffic via PostHog's web
analytics. MRR-gate status references `docs/plans/2026-07-05-agentic-travel-agent-northstar.md`
("The revenue goal" section).

**Standing requirement — check `$virt_traffic_type` before calling any funnel event a real
conversion.** Added 2026-07-22 after this log almost mis-reported a false positive (see that
entry): PostHog's own `filterTestAccounts: true` does **not** exclude events PostHog's traffic
classifier labels `Automation` (its bot/scripted-traffic category, distinct from `Bot`/`AI Agent`)
— a `signed_up` or `first_program_added` event can pass `filterTestAccounts` and still be
non-human. Before reporting any nonzero read on `signed_up`, `first_program_added`, or `outclick`
as a real conversion, break it down by `$virt_traffic_type` (event property) and only count
`Regular`. This is in addition to, not instead of, the `$host` filter below (traffic vs. funnel
events need different corrections; see the 2026-07-12 entry).

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

---

## 2026-07-20

- **Traffic (7d, `$host=hop.flights` filtered)**: 9 visitors, 125 pageviews, 18 sessions, 27.8%
  bounce rate, ~6.3 min avg session. Visitors down from the 7/17 read (14) and the 7/15 read (13)
  — still single-digit-to-low-teens visitors/day, and now trending down rather than flat.
- **Funnel (7d)**: `search_ran`/`verdict_viewed` 13/13 across the week (0 on 7/13, 5/5 on 7/14, 1/1
  on 7/15, 0/0 on 7/16–7/17, 7/7 on 7/18, 0/0 on 7/19, 0/0 partial 7/20) — every search still
  produces a verdict, consistent with prior reads. `outclick` fired twice, both on 7/14 (same two
  as the 7/17 read — no new outclicks in the six days since). **`signed_up` and
  `first_program_added` are zero across all 8 days this window and all 15 days logged since
  2026-07-05** — a 7th consecutive read with no account-creation or program-linking event.
- **MRR-gate status — Wk1 ("payment path proven, one real stranger pays")**: **not met.** N-320
  (seats.aero written commercial terms, owner-only) is still Backlog, `startedAt: null` per Linear
  — unchanged since the last seven reads. The gate has now been open **15 days** (declared
  2026-07-05) on the same single owner-only blocker. Per the 2026-07-19 board review
  (`docs/board/2026-07-19-board-memo.md`), the seats.aero commercial-terms email has sat
  unanswered 13 days, and the risk it was meant to catch is now confirmed rather than
  hypothetical: seats.aero shipped its own AI redemption assistant in June, and a funded
  competitor (Award Travel Finder) already has a live MCP endpoint + Claude plugin shipping hop's
  "balances + AI + MCP" pitch.
- **This run's action**: the 7/19 board review explicitly voted to freeze further content-pipeline
  expansion (`docs/board/2026-07-19-board-memo.md` kill-list #2, a second violation of the same
  freeze this month) and independently ranked its own top agent-executable amendment as a payment/
  UX bug, not new content: `app/pricing/page.tsx`'s `metadata` export was a static object, so the
  `<head>`/social-preview description advertised `$PRO_PRICE_YEARLY_USD/yr` unconditionally, even
  while `HOP_ENABLE_BILLING` is off — contradicting the page body, which already branches
  correctly on `isBillingEnabled()`. This run's growth-desk instructions also rank "unblocking
  payment/upgrade UX bugs" above content, so fixed it directly: converted to `generateMetadata()`
  gated on the same flag, matching the pattern already used in `app/guides/[program]/page.tsx`.
  Verified with `npm run typecheck` (clean), `npm run lint` (0 errors), `npm test` (1353/1353
  passing), and `npm run build` (succeeds; `/pricing` now compiles dynamic as expected for an
  async `generateMetadata()`). Opened PR #304 — mergeable once CI is green
  (`growth/2026-07-20-pricing-metadata-billing-gate`). Did not attempt the fallback award-data-
  source prototype (board amendment #3, N-386) or the content staleness guard (amendment #4):
  both are meaningfully-sized engine/product builds outside this desk's owned-channel scope
  (content, SEO, MCP listings, external-account drafts per N-352), not a quick fix — filed as-is
  for the next dedicated engineering run rather than attempted piecemeal here.
- **Still the single highest-leverage thing sitting undone**: the three ready-to-paste drafts in
  `docs/marketing/drafts/` (Show HN, r/awardtravel sweet-spot math, MCP-directory submissions) have
  now been sitting unposted for **14 days** (the oldest two, drafted 2026-07-06; first flagged
  7/13, flagged every read since — 6th consecutive flag). At 9 visitors/week and falling, this
  remains the dominant explanation for near-zero funnel volume — no amount of on-site work fixes a
  traffic problem. Needs only the founder logged into the respective account, ~5 minutes total.
  The 2026-07-19 board review reached the same conclusion independently via three separate lenses
  (growth operator, CFO, travel-industry) and asked explicitly: "will you post them this week, or
  should the fleet stop re-flagging this and mark community seeding paused?"

---

## 2026-07-27

- **Traffic (7d, `$host=hop.flights` filtered)**: 10 visitors, 66 pageviews, 14 sessions, 50%
  bounce rate, ~3.2 min avg session. Visitors roughly flat vs. the 7/22 read (9) and the 7/26
  strategy-desk read (9) — still a single-digit-to-low-teens-visitors/week site.
- **Funnel (7d)**: `search_ran` 7 (1 on 7/20, 2 on 7/21, 4 on 7/22, **0 every day 7/23–7/27
  partial**), `verdict_viewed` 4 (1/2/1 on 7/20–7/22, 0 since) — same known search/verdict count
  mismatch on 7/22 as the 7/24 entry traced (verdict-only-fires-on-render, not a tracking bug).
  **`signed_up` and `first_program_added` are zero across all 7 days** — a 9th+ consecutive read
  at zero since 2026-07-05. `outclick` (unfiltered — the standing note that server-side outclick
  carries no `$host` applies) shows 1 on 7/26 and 3 on 7/27, the first nonzero outclick reads since
  7/14 — but breaking down by `$virt_traffic_type` per this log's standing requirement shows **all
  4 are `Automation`**, not `Regular`. Same pattern as the 7/22 entry's automation-flagged signup:
  downgraded, not counted as a real conversion. Zero confirmed-`Regular` outclicks since 7/14.
- **New this run — investigated whether the 4 straight zero-funnel days (7/23–7/27) mean the site
  is down, not just quiet**: the zero-activity window starts exactly on 2026-07-23, the same day
  as the last successful merge to `main` (see below), which made the coincidence worth checking
  rather than assuming. Fetched `https://hop.flights` directly: it loads correctly — full nav,
  working search UI, sample destination cards with live-looking cpp values, no error state. Ruling
  this out as an outage; it's a genuine near-zero-traffic read at this site's existing baseline
  volume, not a technical failure.
- **MRR-gate status — Wk1 ("payment path proven, one real stranger pays")**: **not met.** Linear
  was unreachable this session (headless, no interactive OAuth) so N-320's live status couldn't be
  re-verified directly, but no PR or commit anywhere in `n3wth/hop`'s history touches billing/N-320
  since the last read, so nothing indicates it moved. The gate has now been open **22 days**
  (declared 2026-07-05) on the same single owner-only blocker per every prior read.
- **This run's dominant finding — independently reconfirmed, not new, but now acute**: the merge
  pipeline to `main` is still completely wedged, exactly as the 2026-07-26 board memo, the
  2026-07-26 strategy memo, and today's sheriff sweep (PR #345) all found. Reverified live just
  now: PR #332 (a plain docs PR, opened yesterday) still shows the required `Vercel` status check
  as `pending` from the real Vercel GitHub App (`in/8329`) — unchanged since it was opened. A
  second PR opened today, #352, dug one level deeper and found the likely root cause: Vercel *is*
  completing builds and posting `success`, but under a different GitHub App identity (OAuth App
  `oa/1157143`) than the one `main`'s branch protection requires (`in/8329`) — so even a
  green-looking status check gets rejected by GitHub's merge API
  ("Required status check was not set by the expected GitHub app"), not just a slow one. **Last
  successful merge to `main` was PR #317 on 2026-07-23T10:48 UTC — zero merges in the 4 days
  since**, with 25 PRs now queued (#318–#353), including growth-relevant work already built and
  waiting: PR #324 (`/pricing` FAQ + JSON-LD, closes a board kill-list item), PR #347 (SEO
  points-band date fix). This is a repo-admin-only fix (GitHub → repo Settings → Integrations →
  reauthorize/reinstall the Vercel GitHub App so its status posts under the App id branch
  protection expects) — no agent has repo integration-settings access. Given every desk's output
  is blocked on this, not just growth's, and it's now been flagged independently 4 times across
  24+ hours with no founder action logged, escalating this run via direct notification rather than
  filing a 5th silent memo entry.
- **This run's action**: content-pipeline work stays frozen per the 2026-07-19/7-26 board votes,
  and would be moot regardless — nothing merges right now no matter what's built. Pulled and
  verified this week's funnel/traffic numbers (including the automation-flagged outclick check and
  the outage-vs-quiet check above), filed this log entry as a docs-only PR per the same
  can't-merge-anyway constraint as everything else in the queue, and escalated the merge-pipeline
  finding directly rather than re-filing it as unread prose. Did not attempt the community-draft
  posting ask (still owner-only, still the second-highest-leverage founder action after the merge
  pipeline) or any new content/code (frozen + would sit unmerged either way).
- **Still the single highest-leverage thing sitting undone, in order**: (1) re-authorize the
  Vercel GitHub App in GitHub repo Settings → Integrations — unsticks all 25 queued PRs across
  every desk, <5 min, new as of this week's finding; (2) the three ready-to-paste drafts in
  `docs/marketing/drafts/` (Show HN, r/awardtravel, MCP-directory submissions) — now ~21 days
  unposted, flagged every read since 7/13.

---

## 2026-07-22

- **Traffic (7d, `$host=hop.flights` filtered)**: 9 visitors, 46 pageviews, 15 sessions, 40% bounce
  rate, ~5.2 min avg session. Visitors flat vs. the 7/20 read (also 9); pageviews down (125→46) on
  a shorter/different 7-day window. Still a single-digit-visitors-per-day site — no change in
  shape from the last four reads.
- **Funnel (7d)**: `search_ran`/`verdict_viewed` 12/12 across the week (1/1 on 7/15, 0/0 on
  7/16–7/17, 7/7 on 7/18, 0/0 on 7/19, 1/1 on 7/20, 2/2 on 7/21, 1/1 partial 7/22) — every search
  still produces a verdict.
- **Investigated and downgraded — the apparent first-ever `signed_up`**: this window's raw pull
  showed `signed_up` **1** and `first_program_added` **1** on 7/18, which would have been the
  first non-zero read on either event since instrumentation shipped 2026-07-05 (a streak the 7/06
  through 7/20 entries all called out as zero, 8 consecutive reads). Before reporting it as the
  breakthrough it would have been, traced it: referrer breakdown shows 13 pageviews from
  `accounts.google.com` that same day (a completed Google OAuth redirect, not something a naive
  bot fakes) alongside 10 `$direct` — but breaking the `signed_up` event down by
  `$virt_traffic_type` (PostHog's traffic classifier) returns **100% `Automation`**, not `Regular`,
  and this survives `filterTestAccounts: true` (which does not catch this category — see the new
  standing requirement added to this log's header this run). The same day's `search_ran` spike (7
  events, the largest single-day count since 7/14) is **100% `Regular`** by contrast — so 7/18 had
  real human search activity, but the one signup-shaped event traces to scripted/automated traffic
  completing a real OAuth flow, not a confirmed human. Logging as **inconclusive, downgraded from
  "first real signup" to "unexplained automation-flagged signup"** — could be a false-positive bot
  classification on a genuine early user, or could be an agent/QA session (internal or external)
  exercising the real login flow; this session has no way to distinguish the two from PostHog data
  alone. `signed_up`/`first_program_added` remain **zero for confirmed-`Regular` traffic across all
  17 days logged since 2026-07-05.** `outclick` fired zero times this window (last fired 7/14).
- **MRR-gate status — Wk1 ("payment path proven, one real stranger pays")**: **not met.** N-320
  (seats.aero written commercial terms, owner-only) is still Backlog, `startedAt: null` — unchanged
  since the last eight reads. The gate has now been open **17 days** (declared 2026-07-05) on the
  same single owner-only blocker; even the automation-flagged 7/18 signup above wouldn't have moved
  this gate, since billing is still off — no code change this run affects it either.
- **This run's action**: per the 2026-07-19 board kill list (item 2), further `/guides/[program]`,
  sweet-spot, or methodology-page content stays frozen until N-387's staleness guard exists — not
  attempted this run. N-386 (fallback award-data source) remains a real, sizeable engine build
  outside this desk's owned-channel scope (content/SEO/MCP listings/external-account drafts), same
  read as the 7/20 entry. With no in-scope content or payment/upgrade UX bug available this run
  (the `/pricing` metadata gate shipped 7/20 in PR #304; no new defect found today), this run's
  concrete output is the automation-traffic finding above plus the new standing `$virt_traffic_type`
  check added to this log's header — closes board amendment #9 ("add referrer/source-split data
  before drawing further conclusions from traffic reads") by making that check a standing
  requirement rather than a one-off. No PR beyond this log entry.
- **Still the single highest-leverage thing sitting undone**: the three ready-to-paste drafts in
  `docs/marketing/drafts/` (Show HN, r/awardtravel, MCP-directory submissions) have now been
  sitting unposted for **16 days** (oldest two, drafted 2026-07-06; flagged every read since
  7/13 — 7th consecutive flag). New this run: worth also asking the founder to check whether the
  7/18 automation-flagged signup/first-program-add was his own testing or something else — cheap
  to confirm with DB or PostHog person-profile access this session doesn't have, and it would
  resolve real ambiguity in this log rather than leaving it open indefinitely.

---

## 2026-07-24

- **Traffic (7d, `$host=hop.flights` filtered)**: 11 visitors, 62 pageviews, 17 sessions, 47.1%
  bounce rate, ~4.8 min avg session. Visitors up slightly vs. the 7/22 read (9→11) but still a
  single-digit-to-low-teens-visitors/day site with no shape change from the last five reads.
- **Funnel (7d)**: `search_ran` 14 / `verdict_viewed` 11 (0/0 on 7/17, 7/7 on 7/18, 0/0 on 7/19,
  1/1 on 7/20, 2/2 on 7/21, **4/1 on 7/22**, 0/0 on 7/23, 0/0 partial 7/24). **New this run**: the
  first break in the search_ran = verdict_viewed invariant every prior read has reported — 3 of
  the 4 real searches on 7/22 rendered no verdict. Traced it before flagging as a bug: broke the
  4 `search_ran` events down by `$virt_traffic_type` and all 4 are `Regular` (not automation), so
  this isn't the same false-positive pattern as the 7/18 signup. Then checked the code
  (`components/SearchTelemetry.tsx:32-33`): `verdict_viewed` only fires when the search actually
  produced a rendered verdict pick (`if (verdict) track('verdict_viewed', ...)`) — a search with
  nothing to recommend (degraded upstream, no award space, no cash fare) legitimately runs without
  one. This is expected product behavior, not a tracking defect — no code change made. Logging it
  because every prior read's "every search still produces a verdict" line was true by coincidence
  of small sample size, not by invariant; future reads should expect occasional real gaps here.
  `signed_up`/`first_program_added` are zero for `Regular` traffic across all 19 days logged since
  2026-07-05 (the 7/18 automation-flagged event remains the only nonzero read, still unconfirmed
  either way). `outclick` fired zero times this window — last real fire 7/14, 10 days ago now.
- **MRR-gate status — Wk1 ("payment path proven, one real stranger pays")**: **not met.** N-320
  (seats.aero written commercial terms, owner-only) is still Backlog, `startedAt: null` per
  Linear — unchanged since 2026-07-19, now **19 days** open on the same single blocker declared
  2026-07-05. No code change this run affects this gate either way.
- **This run's action**: N-319 (`/pricing`) has been the board's explicit kill-list item #1 for
  three consecutive weekly reviews (7/05, 7/12, 7/19) and its own Linear thread confirmed on
  7/23 that PR #304 (the metadata-gating fix) closed one gap but left the issue's "Done means"
  checklist incomplete: no FAQ section, no JSON-LD, and — new finding this run — **no link to
  `/pricing` anywhere in the site's nav or footer** (`lib/seo-routes.ts`'s `PRIMARY_NAV`,
  `FOOTER_SECTIONS`, `STATIC_SEO_ROUTES`, and `SEO_REVALIDATE_PATHS` all lacked an entry; only
  `/account` linked to it). This is agent-executable, in-scope for the growth desk (on-page SEO
  copy + structured data on an owned page, not new frozen content), and directly named in the
  board's ranked amendment list — so built it: added a 4-question FAQ section
  (`app/pricing/page.tsx`) sourced from `lib/pricing.ts`/`lib/subscription.ts` constants (never
  hand-typed), matching `FAQPage` JSON-LD built from the same source so the two can't drift
  (same pattern as `app/guides/point-value/page.tsx`), and added `/pricing` to `TopNav`,
  `FooterNav`, the sitemap, and the weekly SEO-revalidate list. Verified with `npm run typecheck`
  (clean), `npm run lint` (0 errors, no new warnings), and `npm test` (1356/1356 passing — one
  transient `check-migration-sequence` failure from an untracked stray file another concurrent
  session was writing to this shared container mid-run, gone by the next check, not part of this
  diff). Opened PR #324 (`growth/2026-07-24-pricing-faq-jsonld-nav-link`) — mergeable once CI is
  green. Did not attempt N-386 (fallback award-data source) or N-387 (content staleness guard):
  both remain real engine/product builds outside this desk's owned-channel scope, same read as
  the 7/20 and 7/22 entries — filed as-is for a dedicated engineering run.
- **Still the single highest-leverage thing sitting undone**: the three ready-to-paste drafts in
  `docs/marketing/drafts/` (Show HN, r/awardtravel, MCP-directory submissions) have now been
  sitting unposted for **18 days** (oldest two, drafted 2026-07-06; flagged every read since
  7/13 — 8th consecutive flag). No amount of on-site work fixes a traffic problem this small;
  this and the seats.aero reply (N-320, 19 days unstarted) remain the two founder actions the
  board's 7/19 memo converged on independently from five different lenses.

---

## 2026-07-29

- **Traffic (7d, `$host=hop.flights` filtered)**: 7 visitors, 58 pageviews, 11 sessions, 45.5%
  bounce rate, ~1.5 min avg session. Visitors down vs. the 7/27 read and still the same
  single-digit-per-week baseline this site has held since traffic peaked around 7/10 (95
  visitors) and declined through every subsequent read.
- **Funnel (7d)**: `search_ran` 6, `verdict_viewed` 3 (expected — `verdict_viewed` only fires on a
  rendered pick, per the 2026-07-24 finding, not a tracking gap). `signed_up` **0**,
  `first_program_added` **0** — zero for confirmed-`Regular` traffic across all **24 days** logged
  since 2026-07-05. `outclick` read **5** in the raw pull, the first non-zero outclick count since
  7/14 — before reporting it as a real conversion, broke it down by `$virt_traffic_type` per the
  standing check: **100% `Automation`** (1 on 7/26, 3 on 7/27, 1 on 7/28), 0 `Regular`. Same
  false-positive pattern as the 7/18 `signed_up` event — downgraded, not counted as a real
  conversion. Zero confirmed-`Regular` outclicks since 7/14, now 15 days.
- **MRR-gate status — Wk1 ("payment path proven, one real stranger pays")**: **not met.** N-320
  (seats.aero written commercial terms, owner-only) is still Backlog, `startedAt: null` — the gate
  has now been open **24 days** (declared 2026-07-05) on the same single blocker, unchanged since
  every prior read.
- **Major finding this run — the merge-pipeline stall flagged in the last four reads is
  resolved.** Verified against `main`'s commit history: after zero merges for 4 days
  (2026-07-23T10:48 UTC → 2026-07-27T21:59 PT), a burst of 11 PRs merged in the span of one minute
  at 2026-07-27T21:59 PT (#352, #356, #331, #328, #325, #359, #361, #358, #348, #347, #346, #319,
  #318, #320, #324), and merges have continued normally since — most recently PR #371 at
  2026-07-28T22:57 PT. Whatever fixed the Vercel GitHub App identity mismatch (the repo-admin-only
  fix escalated directly on 2026-07-27) worked; the 25-PR backlog is draining. ~10 PRs remain open
  as of this read (#321, #330, #332, #333, #343, #345, #353, #357, #362, #364) but none are
  growth-owned — this desk's own queued work (#324, #325, #356) already merged in that burst.
- **This run's action**: re-verified the MCP-directory submission blockers from the 7/17 draft
  before re-flagging them as unchanged. PulseMCP now has a discoverable `/submit` form (a "Submit"
  button on `pulsemcp.com/servers`, no login required per the page copy) — tried it directly:
  `curl` against `pulsemcp.com/submit` gets blocked by the site's Cloudflare bot-challenge (403,
  "security service... action triggered the security solution") even with a browser user-agent, so
  it's a JS-rendered form no headless/programmatic path in this session can complete (Chromium
  here can't reach external hosts through the agent proxy either). Same conclusion as 7/17, now
  confirmed against the current page rather than assumed stale. Filed this funnel-log entry
  (docs-only, self-merging once CI is green per standing policy); did not attempt new content
  (freeze still in effect, N-387 still Backlog/unbuilt) or find a new payment/UX bug (none open).
- **Still the single highest-leverage thing sitting undone, in order**: (1) the three
  ready-to-paste drafts in `docs/marketing/drafts/` (Show HN, r/awardtravel, MCP-directory
  submissions) — **23 days** unposted now (oldest two, drafted 2026-07-06), flagged every read
  since 7/13; (2) the seats.aero reply (N-320) — 24 days unstarted, the structural block on the
  entire Wk1 MRR gate. With the merge pipeline now unstuck, neither of these has a technical
  blocker left standing between it and being posted/sent — both are purely a founder
  five-minutes-each action at this point.

---

## 2026-07-31

- **Traffic (7d, `$host=hop.flights` filtered)**: 7 visitors, 62 pageviews, 10 sessions, 30% bounce
  rate, ~3.5 min avg session. Flat vs. the 7/29 read (also 7 visitors) — still the same
  single-digit-visitors/week baseline the site has held since traffic peaked around 7/10 (95
  visitors, later corrected to ~24 hop.flights-only) and declined through every subsequent read.
- **Funnel (7d)**: `search_ran` 8, `verdict_viewed` 8 (0/0 on 7/24–7/28, 3/3 on 7/29, 5/5 on 7/30,
  0/0 partial 7/31). **`signed_up` 1 and `first_program_added` 1, both on 7/30** — before reporting
  either as the first real conversion since instrumentation shipped, broke both down by
  `$virt_traffic_type` per this log's standing requirement: **100% `Automation`**, 0% `Regular`.
  Same false-positive pattern as the 7/18 and 7/22 entries — downgraded, not counted. `signed_up`
  and `first_program_added` remain **zero for confirmed-`Regular` traffic across all 26 days**
  logged since 2026-07-05. `outclick` read 18 across the window (1 on 7/26, 3 on 7/27, 1 on 7/28,
  9 on 7/29, 3 on 7/30, 1 partial 7/31) — broken down the same way, **100% `Automation`** on every
  single day, 0 `Regular`. Zero confirmed-`Regular` outclicks since 7/14, now 17 days.
- **MRR-gate status — Wk1 ("payment path proven, one real stranger pays")**: **not met.** N-320
  (seats.aero written commercial terms, owner-only) is still Backlog, `startedAt: null` in Linear —
  unchanged since every prior read. The gate has now been open **26 days** (declared 2026-07-05) on
  the same single owner-only blocker.
- **Checked the merge pipeline (last flagged stuck 7/27, unstuck 7/29)**: confirmed healthy —
  `main` is current through PR #376 (2026-07-31), with normal merge activity in between (#372–#376,
  including design-system migrations and another funnel-log entry). **New finding, not this desk's
  to fix**: PR #373 is open and unmerged — a same-fleet correction reverting PR #362 (a self-improve
  PR that a merge-queue sheriff run squash-merged in violation of ADR 0009's hold-for-owner list,
  since #362 touched `.github/workflows/data-refresh.yml`) and proposing to flip the `Auto-merge`
  kill switch in `docs/autonomy-runbook.md` to `off`. As of this read the committed runbook on
  `main` still reads `Auto-merge: on` and PR #362's content is still live in `main` — this is a live
  founder decision (keep #362 + flip auto-merge back on, or accept the revert) sitting open since
  2026-07-29, unrelated to growth-desk scope so not actioned here, but surfaced because it
  determines whether future scheduled routines can keep self-merging at all.
- **This run's action**: the content-pipeline freeze (board kill-list, reaffirmed 2026-07-19 and
  2026-07-26) stays in effect — N-387 (the staleness guard that would lift it) is still Backlog,
  unstarted. No new payment/upgrade UX bug found this run (the last one, `/pricing`'s metadata gate,
  shipped 2026-07-20 in PR #304; the FAQ/JSON-LD/nav-link follow-up shipped 2026-07-24 in PR #324 —
  both already merged). Re-verified `app/pricing/page.tsx` still correctly gates its `<head>`
  description and FAQ/JSON-LD on `isBillingEnabled()` — no regression. With no in-scope content or
  bug available, this run's concrete output is this funnel-log entry (docs-only, self-merging once
  CI is green) plus the merge-pipeline governance flag above and the Linear growth-log update.
- **Still the single highest-leverage thing sitting undone, in order**: (1) the three
  ready-to-paste drafts in `docs/marketing/drafts/` (Show HN, r/awardtravel, MCP-directory
  submissions) — now **25 days** unposted (oldest two, drafted 2026-07-06), flagged every read
  since 7/13 — 9th consecutive flag; (2) the seats.aero reply (N-320) — 26 days unstarted, the
  structural block on the entire Wk1 MRR gate; (3) new this run — decide PR #373 (revert the
  ADR-0009-violating merge or re-enable auto-merge), open since 2026-07-29, blocking nothing
  growth-owned today but worth a founder minute since it governs whether the fleet keeps shipping
  autonomously at all.
