# 07 — Compounding memory

## Pattern

Agents have no memory between sessions. Whatever the system knows has to live in files the
next agent reads automatically, either because the harness injects them (rules files) or
because the run procedure says to search them before solving. The compound step (doc 01,
rule 1) is the write path; this doc describes the surfaces and the promotion ladder.

## Memory surfaces

| Surface | Contains | Read when |
|---|---|---|
| Rules files (`AGENTS.md`, or a `CLAUDE.md` importing it, per-tool equivalents) | invariants, commands, gotchas, house style | injected into every session automatically |
| Solutions library (`docs/solutions/`) | solved problems, one file each, YAML frontmatter for searchability | grepped before solving anything that looks familiar |
| ADRs (`docs/decisions/`) | load-bearing decisions with context and consequences | before changing a decided area |
| Plans (`docs/plans/`) | implementation blueprints; the adopted business/sequencing plan | at task start; plans are the source of truth for scope |
| Runbook amendments (`docs/autonomy-runbook.md`) | process rules learned from autonomous-run failures | every autonomous run |
| Run log (`docs/autonomy-log.md`) | dated entries: item, outcome, PR, surprises, blockers | during triage; before re-filing a blocker |
| Reviewer checklists (`.claude/agents/*`) | executable taste: invariants with grep targets and severity rubrics | every machine review |
| Orchestration scripts (`.claude/workflows/*`) | process rules as code: gates, schemas, tallies, exits | every workflow run |

Two distinct read mechanisms, both necessary: rules files are *pushed* into context by the
harness; everything else is *pulled* by procedure ("search before you solve", "read the ADR
before changing a decided area"). A lesson that lands in neither is lost.

## Promotion ladder

When a run learns something, it chooses where the lesson goes by how it should fire later:

1. **Solutions entry** — the default. A searchable record: what happened, why, the fix.
   Fires when a future agent greps for the symptom.
2. **Rules-file line** — for lessons every session needs unprompted. Expensive real estate
   (context tokens on every turn); promote only what's universal.
3. **ADR** — for decisions with alternatives that were considered and rejected. Fires when
   someone (agent or human) is about to relitigate.
4. **Reviewer checklist line** — for bug classes. Fires automatically on every future diff
   that matches. Usually the highest-value target, since the lesson becomes enforcement.
5. **Orchestration-script rule** — for process failures: a new path gate, a stricter
   skeptic, a changed termination condition. Fires on every future workflow run.
6. **Runbook amendment** — for autonomous-run process rules. Fires at the start of every
   future run.

The test when choosing: "where would this have had to live for the problem to not have
happened?" Write it there. If a lesson would have prevented this run's problem, the
amendment ships in the same PR as the fix.

## Writing conventions

- Solutions entries carry YAML frontmatter (date, tags, symptom) so grep and glob find them
  by symptom as well as title. One problem per file, dated filenames.
- Write for a reader with zero session context: define terms on first use, lead with
  what/why. The audience is a fresh agent, which is the least-context reader there is.
- Canon lives in git; work state lives in the tracker (hop's ADR 0008). Don't mirror ticket
  status into docs or decisions into tickets. Each system holds what it's authoritative
  for, and the PR body carries sync notes across the gap when a connector is missing.
- Memory surfaces are audited. Doc/code drift (a command that no longer matches its
  workflow, a rules-file claim the code contradicts) is a standing-audit lens (doc 08),
  because two artifacts describing one process will drift.

## Porting to a google3-style stack

The surfaces map to g3doc (rules, ADRs → design docs), a postmortem/lessons corpus
(solutions library), and analyzer configs (reviewer checklists). The property that's usually
missing and must be added is agent-legibility of the read path. It isn't enough that a
postmortem exists: the agent's context assembly must inject directory-local rules
automatically (per-directory rules files picked up by path, the way OWNERS is), and the run
procedure must mandate a search of the lessons corpus before solving. The write path needs
an owner too: the compound step should be a checklist item on agent-authored CLs, verified
in review like tests are.
