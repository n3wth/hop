# 01 — Principles

Two rules generate the rest of this library.

## Rule 1: capture what each task teaches

The output of a task is the diff plus whatever was learned producing it. The loop:

1. **Plan** — research the codebase and the authoritative docs for your installed framework
   versions, then write a blueprint into a versioned plans directory. Plans are reviewable
   files, not chat scrollback.
2. **Work** — implement in the house style (whatever your equivalents are of flag-gated
   seams, graceful degradation, computed-not-generated outputs).
3. **Review** — machine review first (doc 04), triaged into P1/P2/P3. Humans see the
   verified residue, not the raw diff.
4. **Compound** — write the lesson where the next agent will find it without being told:
   a solutions entry, a rules-file line, an ADR, a reviewer check, or an orchestration-script
   rule (doc 07 lists the targets).

The operational test for step 4: if a rule would have prevented a problem this run hit, amend
the rule file in the same PR. Skipping this step is why most teams get flat returns from
agents — every session starts from zero.

## Rule 2: agents supply judgment; code computes everything between judgments

Anything that must be correct or consistent is computed by checked-in, reviewable code. The
LLM fills judgment nodes only. This applies at three levels:

- **Product**: user-facing numbers (prices, scores, verdicts) come from deterministic library
  code. The agent narrates computed values.
- **Process**: which reviewers run on a diff, what each sees, how findings dedupe, which
  severity wins, when a loop terminates — all encoded in a checked-in orchestration script,
  not re-derived by a model each session (doc 04).
- **Policy**: whether a PR may auto-merge is a predicate over CI state, review state, and
  changed paths — never the agent's own risk assessment (doc 05).

Consequences:

- Agents that feed a pipeline return JSON validated against a schema. Prose is never parsed.
- Machine findings are verified before a human sees them: a skeptic pass, defaulting to
  "refuted", must uphold each one. Confidently flagging correct code is the characteristic
  failure of LLM review, and it has to be handled structurally, not by discipline.
- The process is model-portable. Checklists and scripts carry the quality; swapping in a
  smaller model changes cost, not shape. When more rigor is needed, add skeptics or raise
  vote thresholds rather than reaching for a bigger model.
- Skips, caps, truncations, and fallbacks are logged. Silent degradation in the process is
  a bug, same as in the product.

## Classifying automation

Every automated loop is assigned a class before it exists (hop's ADR 0007):

- **(a)** No LLM anywhere. Deterministic detect → template → file. Health checks, staleness
  detection, metric thresholds.
- **(b)** An LLM writes a work item; humans or CI gate it. Allowed only downstream of
  class-(a) outputs: the agent describes findings the system already computed, with
  read-only access. It never merges and never computes a threshold.
- **(c)** Human-only. Merges outside the tiered policy, flag flips, env/secret changes,
  production migrations, money movement, auth changes. Nothing in (a) or (b) may perform,
  schedule, or approve a class-(c) action.

The classification exists because the common failure is gradual: a class-(b) helper acquires
class-(c) powers one small PR at a time. Requiring each new loop to state its class makes
that drift visible in review.

## Common failures and where they're handled

| Failure | Handled by |
|---|---|
| Agent improvises the review process; results vary by session | Orchestration as code (doc 04) |
| Agent judges its own PR safe to merge | Merge predicate + path hold list (doc 05) |
| Lessons live in chat history and evaporate | Compound step, versioned memory (doc 07) |
| One bad merge ends trust in the whole system | Hold list for irreversible surfaces; kill switch; revert protocol (doc 05) |
| Process quality tied to frontier-model access | Checklists + scripts carry quality; rigor scales by vote count (doc 04) |

## Porting notes

In a google3-style environment: the orchestration script becomes presubmit/analyzer config;
schema-forced outputs become protos; the (a)/(b)/(c) classes align with existing
change-management categories (automated rollouts vs. gated launches vs. two-person
operations). The compound loop's memory maps to g3doc, design docs, and postmortems — the
missing property is usually agent-legibility: memory has to live where an agent's context
assembly picks it up automatically (doc 07), not in a doc a human would know to search.
