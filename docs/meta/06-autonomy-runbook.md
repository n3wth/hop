# 06 — The autonomy runbook

## The pattern

Unattended agent runs (cron-triggered builders, scheduled audits, delegated agents) are
governed by one versioned document they read at the start of every run. The runbook is the
run's brain: queue rules, run procedure, merge policy, guardrails, and an amendments section.
Because it's read at runtime, amending it changes agent behavior on the next run without
touching schedulers, prompts, or permissions — that's also how the loop self-improves and
how the kill switch works (doc 05).

Scheduler prompts stay minimal ("read the runbook, follow it"); the policy lives in the
document, where it's reviewable, versioned, and shared by every agent regardless of vendor.

## What the runbook contains

Sections, from hop's (`docs/autonomy-runbook.md`):

**The fleet.** A table of every agent with a role and trigger: the scheduled builder (picks
the top queue item, ships one PR per run), the weekly audit, interactive delegated agents
(vendor tools pointed at well-specced mechanical items), per-PR review bots, and the human —
listed as a fleet member with an explicit role (merges the hold list; flags, secrets, legal).

**Queue rules.** Where task order comes from (the external tracker, mirrored from a plan
document in the repo), and what a run may never pick: human-only items, frozen areas,
items with unmet blockers or gates, and anything another agent is already working (open PR
or in-progress ticket — this is the work-item lock). One item per run; if it won't fit one
cohesive PR, ship the first slice and leave a handoff note.

A fallback ordering for when the tracker is unreachable (headless environments may lack the
connector): fall back to the plan document's phase order, cross-checking open and merged PRs
so finished work isn't redone. Autonomy can't depend on a SaaS being up.

**Run procedure.** Numbered steps: read the canon files; **triage before building** (prior
runs' red PRs are this run's first work item — doc 08); implement in house style; verify
with the standard gate; open one ready-for-review PR titled with the item ID; merge only per
policy; sync tracker state (or leave a sync note in the PR body for the next connected
session); and the mandatory compound step — append to the run log, write solutions entries,
and amend the runbook itself if a rule would have prevented a problem this run hit.

A waste guard: if triage finds nothing and no eligible item exists, end with no PR, and
never re-file a blocker already recorded in the log.

**Merge policy.** The doc-05 predicate, with the `Auto-merge: on|off` kill-switch line.

**Hard guardrails.** Framed as "violating any of these is a defect, not initiative":
never flip flags, edit secrets, run prod migrations, or touch payment/auth beyond the item's
written spec; never generate an output-of-record number; blocked or ambiguous → file the
blocker and end the run rather than guess.

**Model/cost policy.** Scheduled runs pin a mid-tier model via checked-in settings so
unattended work never burns top-tier capacity; expensive models are a per-session human
choice that doesn't persist to routines.

**Amendments.** An append-only dated list, newest first: rule, date, one-line reason. This is
the runbook's changelog and the primary artifact of the compound loop at the process level.

## Design notes

- **One runbook, many vendors.** Any agent that can read the repo follows the same rules —
  the runbook is vendor-neutral by being a file rather than a prompt.
- **"Blocked → stop" beats "blocked → improvise."** An autonomous run that ends early with a
  filed blocker is a success. Runs that guess produce the expensive failures.
- **Delegation is for connected sessions only.** Interactive sessions may fan work out to
  other agent products (with the full spec pasted in, since external tools can't read your
  tracker); headless runs build, because their connectors may be absent.
- **Verify external writes.** Tracker APIs silently no-op more than you'd expect; the
  runbook instructs agents to confirm a write took effect and to leave a comment for the
  human when it didn't, instead of retrying blind. (This rule is itself an amendment —
  added the day the failure was observed.)

## Porting to a google3-style stack

The runbook maps to a team-owned policy file in the repo (g3doc-adjacent) consumed by the
agent scheduler at run start. Queue rules point at your issue tracker with a
plan-doc fallback; the fleet table lists your scheduled agents, analyzers, and on-call
humans; guardrails reference your change-management classes. The properties to preserve:
read at run start (not baked into prompts), versioned amendments with reasons, the kill
switch as a line in the file, and the mandatory compound step writing back to the same file.
