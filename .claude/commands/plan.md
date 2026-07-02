---
description: Plan lane (40%) — research the codebase + Next 16 docs and write a blueprint to docs/plans/. Plans are the new code.
argument-hint: <feature or bug to plan, e.g. "watch a route's award space and email me on a crossing">
---

# /plan — write the blueprint before the code

You are in the **Plan lane** of hop's compound-engineering loop (Plan 40% → Work 10% →
Review 40% → Compound 10%). The output of this command is **not code** — it is a blueprint
written to `docs/plans/`. A good plan makes the Work lane mechanical and gives the Review lane
something to check against. "Plans are the new code."

The thing to plan: **$ARGUMENTS**

Do not write application code in this command. Research, then write the plan file. Stop there.

**Panel mode (ADR 0006):** when the solution space is wide or contested — a new seam, a
cross-cutting feature, anything where the first plan is probably not the best one — and the
harness has the Workflow tool, prefer
`Workflow({ name: 'plan-panel', args: { task: $ARGUMENTS } })`
(`.claude/workflows/plan-panel.js`): three lens-forced drafts, a judge panel, one synthesized
blueprint written to `docs/plans/`. For a narrow, well-trodden change, continue below.

## 1. Research (read before you reason — never plan from memory)

Read the actual code and docs that this work touches. At minimum:

- **`CLAUDE.md` and `AGENTS.md`** — the invariants you must preserve.
- **The engine seam.** Whatever the feature touches, trace it to the moat:
  `lib/search.ts#assembleSearch` (the single funnel), `lib/cpp.ts` (`cpp = (cash − taxes) ×
  100 / miles`; tiers `≥3.0 green`/`≥1.5 amber`/else muted; `POINTS_THRESHOLD_CPP = 2.5`),
  `lib/concierge-tools.ts#priceTrip`, `lib/accounts.ts#getUserBalances`, `lib/transfers.ts`,
  `lib/destinations.ts`, `lib/standing-orders*.ts` + `lib/standing-orders-model.ts#evaluateOrder`,
  `lib/email.ts#sendAlertEmail`, `lib/standing-orders.ts#markAlertDelivered`, `lib/subscription.ts`,
  `lib/travel-history.ts`, `lib/mcp-tools.ts`. List the exact functions you will call.
- **Existing plans for prior art.** `docs/plans/2026-06-30-eve-agent.md` (the Eve design,
  5 workflows + 12 blockers), `docs/plans/auth-db-migration.md` (planned Neon+Drizzle migration —
  remember runtime is **still Supabase**), `docs/plans/2026-06-29-expansion-roadmap.md`.
  Reuse their decisions; do not contradict them silently.
- **Solved problems.** Skim `docs/solutions/*` — if this problem was solved before, cite it and
  reuse the fix instead of re-deriving it.
- **Framework ground truth.** If the work is framework-level (route handlers, `middleware`/proxy,
  metadata, server actions, caching, `params`/`searchParams`), read the relevant guide under
  `node_modules/next/dist/docs/` first. This is **Next.js 16.2.9 + React 19** — do not assume
  training-data behavior. Cite the guide you read.

Use Grep/Glob/Read aggressively. If the request is a bug, reproduce the reasoning path and find
the exact `file:line` of the defect before proposing a fix.

## 2. Write the blueprint

Pick a date-prefixed slug and write the plan to
`docs/plans/<YYYY-MM-DD>-<slug>.md` (today is in the environment context; match the existing
`YYYY-MM-DD-slug.md` style already in `docs/plans/`). The file must contain, in order:

1. **Title + status line.** `> Plan. Status: proposal.` plus one-sentence TL;DR.
2. **Requirements.** What "done" means, as a checklist. Include the user-visible behavior and the
   non-goals (what this deliberately does *not* do).
3. **Files to touch.** A table: `path` · `change` · `new?`. Be specific — exact files, not "the
   search code." Separate `lib/*` (engine/logic) from `app/*`/`components/*` (surface) from
   `eve/*` (agent) from migrations (`drizzle/*.sql` + `utils/supabase/admin.ts` types +
   `lib/db/schema.ts`).
4. **Engine hooks.** The exact `lib/*` functions this calls and what each returns. Reassert the
   moat: **every economic number (cpp, miles, tier, ranking, verdict, $ saved) is computed by
   `lib/*` and only narrated by an LLM — never invented.** If an LLM is in the loop, say where the
   numbers enter and confirm they come from an engine call.
5. **Flags & seams.** Which feature flag gates this (`isCheckoutEnabled()`, `isGmailHistoryEnabled()`,
   `isEmailEnabled()` = `RESEND_API_KEY` via `lib/email.ts`) and how it **no-ops cleanly
   when off**. New env keys go through `lib/env.ts` (lazy accessors), never `process.env` directly.
6. **Degradation plan.** How each new `lib/*` client / DB call returns `{ok:false}`/a fallback via
   `lib/supabase-helpers.ts#withDb` instead of throwing, and how the surface degrades per-section
   (`degraded[]`, `DegradedNote`). Persistence is **user_id-scoped in code** (service-role bypasses
   RLS) — note the scoping for every new query.
7. **Test plan.** The vitest cases to add (`lib/**/*.test.ts` or `app/**/*.test.ts`, node env) and
   the exact commands (`npx vitest run <file>`, `npm run typecheck`, `npm run build`). Name the edge
   cases: degraded sources, empty balances, idempotent re-fire, threshold boundaries (cpp exactly
   2.5).
8. **Copy & design notes** (only if there's UI/email copy). Terse, confident, state the answer +
   number; no slop/clichés, no emoji, flat editorial (no shadows/gradients/glows); bunny = logo +
   one warm moment per region. Cite `docs/design/copy-spec.md`.
9. **Risks & open questions.** Honest unknowns and the blockers (cross-reference the Eve doc's
   blocker list if relevant). Flag anything irreversible (booking/payment → must be human-gated and
   never touch the live Duffel key).
10. **Review hooks.** Name which `.claude/agents/*` reviewers the Review lane should run for this
    diff (engine-invariant-reviewer, degradation-reviewer, copy-voice-reviewer, nextjs16-reviewer,
    eve-architecture-reviewer, security-reviewer) and why each applies.

## 3. Hand off

End your response with: the absolute path of the plan file you wrote, a 3–5 line summary of the
approach, and the suggested next step (`/clear`, then implement against the plan; then
`/review-parallel`; then `/compound`). Do not start implementing.
