---
description: Standing audit — sweep the whole codebase (not a diff) for invariant drift across the six reviewer domains + the memory surfaces, loop until dry, adversarially verify every finding.
argument-hint: "[optional focus, e.g. eve/ or lib/standing-orders — defaults to the whole repo]"
---

# /audit — has anything drifted?

`/review-parallel` judges a *diff*; this judges the *current tree*. Run it periodically or
before a milestone. It hunts violations of the standing invariants — engine-computed numbers,
graceful degradation, copy voice, Next 16 idioms, Eve architecture, security scoping — **plus
the memory surfaces themselves** (solutions index vs disk, code contradicting an Accepted ADR,
a solved problem reintroduced, AGENTS.md claims gone stale).

Optional focus: **$ARGUMENTS**.

## 1. Run the workflow

If the harness has the **Workflow tool** (ADR 0006):
`Workflow({ name: 'invariant-audit', args: { focus: $ARGUMENTS || undefined } })`
(`.claude/workflows/invariant-audit.js`). It loops finder rounds until two consecutive rounds
surface nothing new, and only findings that survive a 2-of-3 skeptic majority come back.

**Manual fallback** (no Workflow tool): dispatch the six `.claude/agents/*` reviewers over the
focus area as codebase sweeps (not diff reviews), and yourself check the memory surfaces listed
above. Verify each finding by reading the code at the claimed `file:line` before reporting it —
default to discarding a finding you cannot concretely confirm.

## 2. Triage like a review

Present the confirmed findings as one P1/P2/P3 list (same severity bar as
`/review-parallel` §3). Note the audit's `exhausted` flag — if it stopped at the round backstop
without going dry, say the tail may remain.

## 3. Fix and compound

Fix P1s one at a time, each as its own isolated change. Then `/compound` **every confirmed
finding** — an invariant that drifted silently is precisely the lesson the loop exists to
capture: the fix is the patch, the compound step is the reviewer check / test / rule that makes
the drift impossible to repeat quietly.
