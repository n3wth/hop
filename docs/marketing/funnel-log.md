# Growth desk funnel log

Append-only. One entry per run (Mon/Wed/Fri), each a short trend note pulled from PostHog —
never invented. Source events: `signed_up`, `first_program_added`, `search_ran`,
`verdict_viewed`, `outclick` (R0.5, `lib/*` instrumentation); web traffic via PostHog's web
analytics. MRR-gate status references `docs/plans/2026-07-05-agentic-travel-agent-northstar.md`
("The revenue goal" section).

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
