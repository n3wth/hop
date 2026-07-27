# 05 — Tiered autonomous merge

## Problem

With agents producing machine-reviewed PRs on a schedule, a strictly human-gated merge makes
the human the bottleneck for changes whose whole risk surface is already checked. But "the
agent decides what's safe" is self-grading. The resolution is a mechanical merge predicate, a
path-based hold list, and a kill switch. Risk is tiered by what changed, never by the
agent's opinion.

## Merge predicate

An autonomous session may merge a PR (its own or another agent's) only when all four hold:

1. **CI green on the head commit**: the full gate plus the production build. No
   skipped-because-red reruns.
2. **Reviews clear**: zero unresolved review threads; no bot findings left unaddressed.
3. **Diff within the work item's written scope**: nothing riding along. (This is why PR
   bodies carry a scope statement, doc 03.)
4. **Every changed path is auto-tier.** A PR that is partially auto-tier is entirely held.

Mechanics: merge method matching repo convention, delete the branch, sync the tracker. Any
doubt → hold, with a PR comment saying why. The policy states "a held PR is a success, not a
failure" verbatim; without that sentence agents rationalize their way past edge cases.

## Hold list

Derive yours from: irreversible, security-critical, or self-referential. hop's list:

| Held surface | Why | Generalizes to |
|---|---|---|
| Migrations + schema files | irreversible; ordering races across parallel workspaces | any DDL, data backfills |
| Money and identity code (billing, payments, auth, sessions, tokens, checkout) | worst-case blast radius | payments, authn/z, PII pipelines |
| Env/flag definitions; middleware; deployment config | changes what "on" means in production | launch configs, routing, IaC entry points |
| CI workflow definitions | CI is the merge gate; an agent edit could weaken the gate judging it | presubmit/analyzer config; the merge-policy file itself |
| Dependency manifests / lockfiles | supply chain | third-party deps, vendored code |
| Displayed prices; frozen subsystems | product integrity; explicit freezes | anything under a change freeze |

The self-referential entry is the one teams forget: the machinery enforcing the policy (CI
config, the hold list, the runbook's guardrails) is itself always hold-tier. Agents must
not be able to merge changes to the gate that judges them.

## Kill switch

The runbook (doc 06) carries one line: `Auto-merge: on`. Autonomous runs read the runbook
before acting, so flipping the line to `off` in a docs-only commit stops all autonomous
merging on every agent's next run, with no trigger or permission changes. Properties to keep
in a port:

- it's a document read at runtime, not a deploy;
- it's versioned; the flip and the re-enable both leave history with a reason;
- the incident protocol sits next to it: one bad autonomous merge → revert, flip the switch,
  record the lesson as a runbook amendment before re-enabling.

## Accepted risk

A green-but-wrong change can ship. Accepted, with named mitigations: the hold list keeps
auto-tier mistakes revertable; a periodic audit re-reviews the week's autonomously-merged
diffs (doc 08); the revert-flip-amend protocol converts each failure into a policy change.
In exchange, docs, tests, and in-scope product code outside the hold list flow to trunk
unattended, and humans review only money/identity/schema/deps.

## Porting to a google3-style stack

- The predicate is a submit rule: presubmit green + no unresolved findings + changed-paths ∩
  hold-patterns = ∅.
- Path tiers express as per-directory metadata (OWNERS-adjacent): a `risk_tier: auto|hold`
  attribute; a CL is auto-tier only if every touched directory is.
- The scope check is an analyzer comparing changed files against the ticket's declared
  surface.
- Keep the kill switch a config value in a well-known file read by the agent scheduler each
  run. A reviewed commit as the disable mechanism leaves an audit trail; treat that as a
  feature rather than a limitation to engineer away.
- Two-person-review requirements can coexist: where policy allows, the machine-review +
  skeptic pipeline satisfies the second party for auto-tier paths; elsewhere it falls back
  to human review. Start with docs and tests as the only auto-tier and widen directory by
  directory as uphold-rate and revert-rate data come in.
