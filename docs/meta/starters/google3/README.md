# google3 starter — agentic process kit (illustrative)

An annotated example of the same process for a google3-style monorepo: citc-like clients,
CLs, presubmit (TAP-style), Tricorder-style analyzers, OWNERS, per-directory metadata.
Internal infrastructure isn't reproducible in public files, so syntax here is plausible
rather than runnable — treat this as the design sketch to hand an infra team, alongside the
mapping table in `../../09-porting-guide.md`.

## Contents

```
policy/agent-policy.md           the runbook: fleet, queue, merge policy, kill switch, amendments
policy/dir-metadata.example      per-directory risk_tier attribute (the hold list, distributed)
policy/submit-rule.example       the merge predicate as a submit rule
analyzers/README.md              LLM reviewers as analyzers + the skeptic second pass
analyzers/security.md            example reviewer checklist (analyzer-shaped)
```

## What maps where

| Pattern (doc) | google3-style home |
|---|---|
| Isolated workspace (02) | citc client per task — native; add a no-prod-credentials env tier for agent jobs |
| One task → one CL (03) | CL with ticket ID + scope statement in description; provenance tags for agent authors |
| CI gate (03) | presubmit; the "local gate = CI gate" rule means agents run the same presubmit target locally before mailing |
| Preview (03) | per-CL staging job / experiment config; result posted to the CL |
| Machine review (04) | analyzers producing structured findings as robot comments; skeptic pass as a second analyzer |
| Tiered merge (05) | submit rule over per-directory `risk_tier` metadata + the kill-switch file |
| Runbook (06) | `policy/agent-policy.md`, read by the agent scheduler at run start |
| Memory (07) | per-directory rules files auto-injected into agent context (OWNERS-style resolution); lessons corpus searched by run procedure |
| Self-healing (08) | monitoring jobs filing fingerprinted tracker bugs; scheduler triages red agent CLs first |

## The pieces that are genuinely new

Most of this stack exists internally already. The net-new work for agents:

1. **Per-directory `risk_tier`** (see `policy/dir-metadata.example`) and a submit rule that
   requires every touched directory to be `auto` before an agent may submit.
2. **The skeptic analyzer** — consumes another analyzer's findings and must uphold each
   before it surfaces. Track uphold-rate per reviewer.
3. **Agent-legible memory** — per-directory rules files resolved like OWNERS and injected
   into agent context automatically; a mandated search of the lessons corpus in the run
   procedure.
4. **Scheduler rules** — triage-before-building (query the fleet's open CLs with failing
   presubmit first), one-item-per-run, the kill-switch check.
5. **Two-person review compatibility** — where policy allows, the analyzer + skeptic
   pipeline satisfies the second party for `auto`-tier directories; elsewhere human review
   applies unchanged. Start with docs and tests as the only `auto` tier.
