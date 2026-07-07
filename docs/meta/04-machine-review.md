# 04 — Machine review

## Pattern

LLM code review works when the orchestration is deterministic and the findings are verified.
Left to improvise, a session skips a reviewer, merges duplicates inconsistently, or forwards
a wrong-but-plausible finding. Reviewer judgment therefore lives in checked-in checklists,
and a checked-in script computes everything between judgments.

```
captured diff
   ├─ path gates (regexes in the script) select applicable reviewers
   ├─ N specialized reviewers run in parallel; findings return as JSON
   │  against a schema (severity enum lives in the schema)
   ├─ dedup by file:line (a computed map)
   ├─ same-location contradictions → one adjudication pass with fresh evidence
   ├─ skeptic pass per finding, default verdict "refuted"
   └─ upheld P1/P2/P3 → P1s fixed by an agent on the branch → P2/P3 filed
```

## Reviewers

Reviewers are specialized, each enforcing a small set of named invariants with grep targets
and a severity rubric in its checklist file. hop's six, as templates:

| Reviewer | Enforces | Generalizes to |
|---|---|---|
| engine-invariant | user-facing numbers are computed by library code, never LLM-generated | any domain where outputs of record (money, scores, rankings) must be deterministic |
| degradation | clients return typed failure results, never throw into a page or agent | your resilience contract |
| security | secret handling, per-user scoping on every query, route authz, no secrets in client bundles | your security checklist, made executable |
| framework-version | code matches the installed framework's documented behavior, not training data | pin any fast-moving dependency; point the reviewer at vendored docs |
| copy-voice | UI text obeys the written voice spec | style guides, i18n, a11y text rules |
| subsystem-architecture | a co-located runtime keeps its boundary (build isolation, gating) | any monorepo neighbor with different rules |

Properties:

- The checklist carries the taste, which is what makes review model-portable: reviewers are
  pinned to a cheap model, so wide fan-out stays affordable regardless of the driving model.
- Applicability is a path regex in the script. A diff touching `app/api/auth/**` gets the
  security reviewer every time.
- Adding a reviewer check is a standard output of the compound step: when a bug class
  recurs, the fix includes a checklist line that catches it next time (doc 07).

## Skeptic verification

An LLM reviewer will confidently flag correct code. The countermeasure is structural, not
disciplinary:

- Every finding gets a skeptic pass: an agent prompted to refute it, reading the code fresh,
  with "refuted" as the default verdict. Only upheld findings reach a human.
- Rigor scales by adding skeptics (majority-must-uphold), not by using a bigger model. hop's
  audit workflow uses a 2-of-3 panel; the review workflow takes a 1–3 skeptic argument.
- Two reviewers landing on the same `file:line` with different claims is a contradiction,
  not a duplicate. It triggers one adjudication pass with fresh evidence. "Keep the higher
  severity" throws away one reviewer's signal.

## Script constraints

Worth copying whatever your workflow engine is (hop: `.claude/workflows/*.js`):

- Agents return JSON validated against a schema; prose is never parsed.
- Every skip, truncation, and budget stop is logged.
- Loops terminate on a counted condition (e.g. two consecutive dry rounds), not "when it
  feels done".
- No wall-clock or randomness in the script body — keeps runs replayable.
- Parallel by default; a synchronization barrier exists only where a stage needs all prior
  results, with a comment saying why.
- Each workflow has a prose recipe of the identical process, so a harness without the
  workflow engine (another agent product, a human) can run the same loop manually. Two
  artifacts describing one process will drift; the standing audit (doc 08) checks them
  against each other.

## Ship pipeline

Review composes into a merge pipeline (hop: `pr-merge-pipeline`): PR number → reviewers →
adjudication → skeptics → a fix pass on the PR branch if P1s survive → branch update → CI
wait → merge under the tiered policy (doc 05). Findings route back to an agent for fixing
before any human is involved; humans see either a clean merge notification or a held PR
with verified findings.

## Porting to a google3-style stack

- The orchestration script becomes analyzer pipeline config: path gates are file-pattern
  triggers, schema outputs are protos, findings post as robot comments with structured
  severities.
- The skeptic stage is the novel part: a second analyzer that consumes the first's findings
  and must uphold each before it surfaces or blocks submit. Track uphold-rate per reviewer;
  a reviewer whose findings are mostly refuted gets its checklist fixed.
- Checklists live beside the code they guard (OWNERS-adjacent), so team-local invariants
  ride with directory ownership.
- The fix pass is an auto-fix service: upheld findings above a severity bar dispatch a fixer
  agent onto the CL before a human reviewer is assigned.
