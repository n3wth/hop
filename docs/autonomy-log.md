# Autonomy run log

- 2026-07-04 · setup (interactive) · ops · CI gains a markdown-only short-circuit (autonomy PRs
  are frequently docs-only; the required check now passes in seconds for them);
  `.github/workflows/**` added to the ADR 0009 hold list (CI is the merge gate — agents must
  not edit it unattended); project model pinned to Sonnet in `.claude/settings.json` so routine
  runs never draw top-tier subscription capacity.
- 2026-07-04 · setup (interactive) · fleet change · Owner added Google Jules (free tier) and
  removed Devin (cost: ~$4.50–11/small task vs $0). Runbook fleet table + dispatch policy
  updated; Jules gets pasted specs (no Linear delegation) and the standard ADR 0009 merge bar.

> One dated entry per autonomous run (dev routine, weekly audit, delegated agents when
> observed). Newest first. Format: `date · agent · item · outcome (PR link) · surprises/lessons`.
> Blockers land here too — a blocked run that files its blocker is a successful run.

- 2026-07-04 · setup (interactive) · — · Runbook adopted; routines "hop autonomous dev" (every
  6h) and "hop weekly invariant audit" (Sun 14:00 UTC) created; N-303 marked Cursor-ready (MCP
  delegation silently no-ops — owner delegates in the Linear UI; captured as a runbook
  amendment). · Headless sessions lack Linear connector + `LINEAR_API_KEY`, so runs may operate
  in git-fallback mode until the key is added to the environment.
