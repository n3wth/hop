---
description: Compound step (10%) — capture what was just learned as a searchable docs/solutions entry, and promote durable rules into CLAUDE.md / an ADR / a reviewer check so it auto-catches next time.
argument-hint: "[what was learned — a bug, a gotcha, a decision. Defaults to the last task.]"
---

# /compound — teach the system, don't just fix the thing

You are in the **Compound step** (10% of the loop: Plan 40% → Work 10% → Review 40% →
Compound 10%). The principle: **"each unit of work should make subsequent work easier"** and
**"teach the system, don't do the work yourself."** A fix that lives only in a diff is a fix you
will re-derive next quarter. Your job is to turn this one lesson into **persistent memory** and,
where it's durable, into an **automatic safety net** so the issue can't recur silently.

The lesson to capture: **$ARGUMENTS** — if empty, use what was just learned in this session
(the last bug fixed, gotcha hit, or decision made). Restate the lesson in one sentence before you
write anything, so we agree on what we're capturing.

## 1. Always: write a searchable solution entry

Append (or create) `docs/solutions/<YYYY-MM-DD>-<slug>.md` (today is in the environment context).
This is the searchable record of solved problems. Use YAML frontmatter so future greps/agents find
it, then the body:

```md
---
title: <short title>
date: <YYYY-MM-DD>
tags: [<engine|degradation|copy|nextjs16|eve|security|db|flags>, ...]
severity: <P1|P2|P3>
files: [<repo-relative paths the fix touched>]
reviewer: <which .claude/agents/* reviewer owns this, or "none yet">
---

## Problem
<the symptom + the root cause, concretely. Include the failing input → wrong output.>

## Fix
<what changed and why it's correct. Reference the engine hook / invariant it restores.>

## How it's caught next time
<the new test, reviewer check, or CLAUDE.md rule that makes this auto-detected.>
```

Keep it terse and concrete (match hop's doc voice). Name exact `file:line` and `lib/*` functions.

## 2. If it's a durable rule: promote it

A lesson is **durable** if it would apply to future work, not just this diff. Promote it to the
narrowest home that will actually fire:

- **A reviewer check (preferred — it's an automatic safety net).** If an existing
  `.claude/agents/*` reviewer *should* have caught this, add the specific check to that reviewer's
  markdown (engine-invariant, degradation, copy-voice, nextjs16, eve-architecture, security). Be
  concrete: add the grep target, the `file:line` pattern, or the failure scenario to its "What to
  check" list and severity table. "Build safety nets, not review processes."
- **A test.** If it's mechanically checkable, add/extend a vitest case (`lib/**/*.test.ts` or
  `app/**/*.test.ts`, node env) so CI catches it. Prefer a test over a prose rule whenever possible —
  verify it actually fails on the old behavior.
- **CLAUDE.md.** If it's a project-wide convention every agent must follow (a new invariant, a flag,
  a gotcha), add a tight line to the relevant section of `CLAUDE.md`. Don't bloat it — one sentence,
  in the right section, no duplication.
- **An ADR.** If it's a non-obvious *decision* with tradeoffs (why we chose X over Y), write
  `docs/decisions/<YYYY-MM-DD>-<slug>.md`: `# <decision>`, then **Status / Context / Decision /
  Consequences / Alternatives considered**. ADRs are append-only; supersede, don't rewrite.

Not every lesson needs all four — pick the ones that make it auto-catch. A one-off typo gets only a
solution entry; a recurring invariant breach gets a reviewer check **and** a test.

## 3. Verify the lesson will actually fire next time

This is the step that makes compounding real. Confirm the safety net works:

- If you added a **test**, run it and show it passes (and would have failed before):
  `npx vitest run <file>`.
- If you added a **reviewer check**, re-run that reviewer over the relevant diff and confirm it now
  flags the pattern (or would on a reintroduction). Sanity-check the grep target hits the right lines.
- If you edited **CLAUDE.md / an ADR**, confirm it's in the right section and doesn't contradict an
  existing rule.

If the lesson can't be made to auto-fire, say so explicitly and note the residual risk in the
solution entry's "How it's caught next time" section (e.g. "manual: reviewers must remember X").

## 4. Report

End with: the absolute path of the solution entry, any files you promoted the rule into
(reviewer / test / CLAUDE.md / ADR), and a one-line statement of how the issue is now auto-caught.
Remember the 50/50 rule — roughly half the work should improve the system, not just ship the
feature. This step is that half.
