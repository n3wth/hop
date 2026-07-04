# 0009. Tiered autonomous merge

Status: Accepted
Date: 2026-07-04

## Context

ADR 0007 classed merges as (c) — human-only — when no autonomous sessions existed. Now they do:
the "hop autonomous dev" and "hop weekly invariant audit" routines produce PRs on a schedule,
every PR already gets automated review (charliecreates + the Vercel agent + the repo's own
`review-parallel` workflow when available), and CI enforces `npm run check` + `next build`. With
merges strictly human-gated, a solo owner becomes the throughput bottleneck for changes whose
entire risk surface is already machine-checked. On 2026-07-04 the owner explicitly authorized
autonomous merging "at the right times." This ADR defines those times; it supersedes ADR 0007's
class-(c) treatment of merges *only* for the tier below — everything else in 0007 stands.

## Decision

An autonomous session may merge a PR (its own or another agent's) **only when ALL of these
hold**:

1. **CI is green** — the `check` job (lint + typecheck + tests) and build have passed on the
   head commit. No skipped-because-red reruns.
2. **Reviews are clear** — no unresolved review threads, and no bot review with actionable
   findings left unaddressed.
3. **The diff is within the picked item's written scope** — nothing opportunistic riding along.
4. **Every changed path is auto-tier.** The hold list below wins over everything.

**Hold-for-owner list — never auto-merged, no exceptions:**
- `drizzle/**` (migrations) and any schema change in `lib/db/schema.ts`
- Money and identity: `lib/stripe.ts`, `lib/billing.ts`, `lib/subscription.ts`,
  `app/api/billing/**`, `app/api/webhooks/**`, `app/api/subscriptions/**`, `lib/auth*.ts`,
  `lib/session.ts`, `lib/api-tokens.ts`, `app/api/auth/**`, checkout/`lib/duffel-orders.ts`
- `lib/env.ts` when it adds/changes flags or keys; `middleware`/`proxy`; `vercel.json`
- `package.json`/lockfile dependency changes (supply-chain risk)
- Any displayed price, and `eve/**` (frozen anyway)

Mechanics: merge-commit method (matches repo history), delete the branch after, sync the Linear
issue. A PR that is only *partially* auto-tier is entirely held. Any doubt → hold and say why in
a PR comment; a held PR is a success, not a failure.

**Kill switch**: the runbook's merge-policy section carries an `Auto-merge: on` line. Routines
read the runbook every run — the owner (or any session) flips it to `off` in one docs commit to
stop all autonomous merging without touching triggers. Flag flips, env/secrets, prod migrations,
and money movement remain class (c) exactly as ADR 0007 wrote them.

## Consequences

- Docs, tests, review-clean mechanical fixes, and in-scope product code outside the hold list
  now flow to main unattended; the owner reviews money/identity/schema/deps only.
- Accepted risk: a green-but-wrong change can ship. Mitigations: the hold list covers the
  irreversible surfaces; the weekly audit routine re-reviews the week's autonomously-merged
  diffs as part of its sweep; one bad autonomous merge → revert, flip the kill switch, and
  record the lesson as a runbook amendment before re-enabling.
- The runbook's guardrail changes from "never merge" to "merge per ADR 0009"; routine prompts
  reference the policy rather than embedding it, so the policy can evolve by PR.
