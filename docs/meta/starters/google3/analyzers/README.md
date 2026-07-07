# Analyzers — LLM reviewers + the skeptic pass

Machine review (pattern-library doc 04) implemented as presubmit analyzers. Each reviewer
is an analyzer whose judgment lives in a checked-in checklist (see `security.md` for the
shape); the pipeline around them is analyzer config, not model behavior.

## Pipeline

```
CL snapshot
  ├─ trigger: file-pattern gates select applicable reviewers (path regexes in config)
  ├─ reviewers run in parallel; findings are structured protos
  │    {file, line, category, severity: P1|P2|P3, claim, evidence}
  ├─ dedup by (file, line); same-location contradictions → one adjudication pass
  ├─ skeptic analyzer: consumes findings, re-reads the code fresh, must positively
  │    uphold each; default verdict REFUTED; only upheld findings post as robot comments
  └─ upheld P1s → auto-fix service dispatches a fixer agent onto the CL
       before a human reviewer is assigned
```

## Rules

- Findings are protos, never parsed prose. The severity enum lives in the schema.
- Refuted findings are logged, not posted — review fatigue from plausible-but-wrong
  findings is the failure mode that kills analyzer credibility.
- Track uphold-rate per reviewer. A reviewer mostly refuted gets its checklist fixed;
  uphold-rate and rollback-rate are the data that justify widening `risk_tier: auto`.
- Rigor scales by skeptic count (majority-must-uphold), not by model size. Reviewers run
  on a cheap model; the checklist carries the quality.
- Reviewer checklists live next to the code they guard (g3doc, OWNERS-adjacent) so
  team-local invariants ride with directory ownership; the trigger config maps directory →
  checklist.
- The analyzer definitions themselves are `risk_tier: hold` — agents don't edit the gate
  that judges them.
