---
description: Benchmark each docs/meta/ pattern against current best-in-class and novel proven external practice, and apply concrete sourced improvements found.
argument-hint: "[optional pattern slug to focus on, e.g. 05-tiered-auto-merge — defaults to all ten patterns]"
---

# /pattern-benchmark — is this still the best known way, or just the first way we found?

`docs/meta/` exists so hop's process ports elsewhere (doc 01). That claim only holds if the
patterns stay current against the outside world — a pattern doc that only ever reflects "how hop
happened to solve this once" quietly drifts into a local optimum nobody re-checks. This command
is that check, run periodically (quarterly is reasonable) or whenever a pattern doc feels stale.

Optional focus: **$ARGUMENTS** (a pattern slug, e.g. `07-compounding-memory`).

## 1. Run the workflow

If the harness has the **Workflow tool** (ADR 0006):
`Workflow({ name: 'pattern-benchmark', args: { focus: $ARGUMENTS || undefined } })`
(`.claude/workflows/pattern-benchmark.js`). It researches each pattern independently — read the
doc as written, web-search for comparable current practice elsewhere, decide whether there's a
concrete sourced improvement — and only edits the doc when the research stage found one specific
enough to write in, citation included.

**Manual fallback** (no Workflow tool): for each pattern doc in `docs/meta/` (or just the focused
one), (a) read it in full, (b) search the web for current best-in-class or novel proven practice
on the same problem at other engineering orgs, well-known OSS projects, or AI-coding-agent
companies — real sources only, never cite from memory or invent a URL, (c) if you find a concrete,
sourced technique the doc is missing, write a new subsection in the doc's existing terse voice
with an inline source link; if you only find confirmation of what hop already does, note that
inline as external validation rather than padding the doc; if nothing concretely comparable turns
up, leave the doc alone — no forced edit.

## 2. Review what changed

Read the diff in `docs/meta/`. Every applied section should carry a real, checkable source link —
if one doesn't, that's a defect in the run, not a style nitpick (an uncited claim in a pattern
doc other repos will copy is exactly the failure mode `10-single-source-of-truth.md` warns about:
a restated "fact" with no owner to verify against). Drop anything that reads as generic advice
rather than a specific technique.

## 3. Handle out-of-scope ideas, then compound

The workflow surfaces `outOfScopeIdeas` — things research found that don't fit any existing
pattern's scope. Skim them: a recurring idea across runs is a candidate for an eleventh pattern
doc, not something to force into an unrelated one. Then `/compound` anything non-obvious that
came out of this run (a technique worth a `docs/solutions/` entry, or a rule worth promoting into
`AGENTS.md`) so the next benchmark pass starts from a better baseline.
