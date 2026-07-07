# Agent policy for <team> (the runbook)

> Read by the agent scheduler at the start of every unattended run. Amendments change
> behavior on the next run; no scheduler or permission changes needed. This file is itself
> `risk_tier: hold`: agents may propose amendments, humans submit them.

## Fleet

| Agent | Role | Trigger |
|---|---|---|
| scheduled builder | top queue item from the tracker hotlist, one CL per run | cron |
| weekly audit | codebase sweep over HEAD for invariant drift; re-reviews the week's auto-submitted CLs | cron, weekly |
| analyzers + skeptic pass | machine review on every CL | presubmit |
| auto-fix service | dispatches a fixer agent on upheld findings before human review assignment | on upheld P1 |
| team (human) | submits hold-tier CLs; flags, configs, schema, launches | — |

## Queue rules

1. Source of order: the team's tracker hotlist, priority order. Tracker unreachable →
   the roadmap doc's phase order, cross-checking submitted CLs so finished work isn't redone.
2. Never pick: human-only items; items with unmet blockers; anything with an open CL or
   in-progress assignment by another agent or human.
3. One item per run; oversized items → first shippable slice + handoff note in the run log.

## Run procedure

1. Read this file and the directory-local rules files for every directory to be touched.
2. Triage first: the fleet's open CLs with failing presubmit or merge conflicts are this
   run's work item.
3. Implement; run the presubmit target locally before mailing.
4. One CL: ticket ID + scope statement + test plan in the description; agent provenance tags.
5. Submit only per the merge policy below.
6. Waste guard: nothing actionable → end with no CL; never re-file a logged blocker.
7. Compound (mandatory): run-log entry; non-obvious fixes → the lessons corpus; a rule that
   would have prevented this run's problem → propose an amendment to this file in the same
   or a follow-up CL.

## Merge policy

**Auto-merge: off**  *(kill switch — one reviewed edit to this line stops all autonomous
submits on every agent's next run)*

An agent may submit a CL only when ALL hold:

1. Presubmit green on the current snapshot (no skipped-because-red reruns).
2. Zero unresolved comments; no analyzer finding upheld by the skeptic pass left unaddressed.
3. Changed files ⊆ the ticket's declared surface (scope analyzer green).
4. Every touched directory is `risk_tier: auto` (see dir-metadata). A CL touching one
   `hold` directory is entirely held.

Doubt → hold, with a CL comment saying why. A held CL is a success.
Incident protocol: one bad autonomous submit → rollback CL, flip the switch off, amendment
here before re-enabling.

## Hard guardrails (violating any is a defect, not initiative)

- Never submit outside the policy above.
- Never change launch/experiment configs, flags, secrets, schema, or quota beyond the
  ticket's written spec; those are human-submitted regardless of tier.
- Never generate an output-of-record number; production values come from checked-in code.
- Blocked or ambiguous → file the blocker and end the run. Do not guess.

## Amendments

*(append: rule, date, one-line reason; newest first)*

- YYYY-MM-DD · Initial version.
