export const meta = {
  name: 'review-parallel',
  description:
    "Review lane: hop's six standing reviewers fan out over one captured diff, every finding is adversarially verified at file:line, and the survivors merge into a single P1/P2/P3 list.",
  whenToUse:
    'After implementing a change, before merge. args: { base?: string } — a git ref to diff against (default "main"; the working diff is always included).',
  phases: [
    { title: 'Scope', detail: 'capture the diff once so every reviewer judges the same change' },
    { title: 'Review', detail: 'standing reviewers from .claude/agents/, path-gated, in parallel' },
    { title: 'Verify', detail: 'one adversarial skeptic per finding — confirm at file:line or kill' },
  ],
}

// Orchestration is deterministic (ADR 0006): this script decides who reviews, what they
// see, and how findings merge. The agents supply judgment inside each node — nothing else.

const base = (args && args.base) || 'main'

// The six standing reviewers (.claude/agents/*). `paths` gates each one on the changed
// file list — the same "skip only if the diff plainly cannot trigger its domain" rule as
// .claude/commands/review-parallel.md, made deterministic. Skips are logged, never silent.
const REVIEWERS = [
  {
    key: 'engine-invariant-reviewer',
    paths: /^(lib|app|components|eve)\//,
    domain:
      'every economic number (cpp, miles, price, $ saved, tier, ranking, verdict) is computed by lib/* and only narrated by an LLM — never invented, re-derived, or hardcoded outside lib/cpp.ts',
  },
  {
    key: 'degradation-reviewer',
    paths: /^(lib|app|components|eve|utils|drizzle)\//,
    domain:
      'lib/* clients and DB helpers return {ok:false}/fallbacks via withDb and never throw to a page, route, or agent; surfaces degrade per-section via degraded[]',
  },
  {
    key: 'copy-voice-reviewer',
    paths: /^(app|components|eve)\/|^docs\/design\/|^lib\/(email|concierge)/,
    domain:
      'copy-spec voice (terse, state the answer + number, no slop, no emoji spam) and flat-editorial design (no shadows/gradients/glows, tokens over hex, WCAG AA, motion gated)',
  },
  {
    key: 'nextjs16-reviewer',
    paths: /^app\/|^(middleware|instrumentation|next\.config)\.ts$/,
    domain:
      'framework code matches Next.js 16.2.9 + React 19 per node_modules/next/dist/docs (async params/searchParams, route handler + middleware shapes, caching defaults) — not training-data Next',
  },
  {
    key: 'eve-architecture-reviewer',
    paths: /^eve\/|^lib\/(standing-orders|email)|^vercel\.json$/,
    domain:
      'Eve tools wrap lib/* (no duplicated economics), seams are flag-gated with graceful no-ops, deliveries are idempotent, irreversible actions stay human-in-the-loop',
  },
  {
    key: 'security-reviewer',
    paths: /^(lib|app|utils|drizzle|scripts)\/|^middleware\.ts$|^\.env/,
    domain:
      'user_id scoping on every withDb query (service-role bypasses RLS), hop_ tokens hashed not plaintext, lazy env via lib/env.ts, no secrets in logs/responses/client bundles, route/cron authz',
  },
]

const SCOPE_SCHEMA = {
  type: 'object',
  properties: {
    empty: { type: 'boolean' },
    files: { type: 'array', items: { type: 'string' } },
    summary: { type: 'string' },
    diff: { type: 'string' },
    truncated: { type: 'boolean' },
  },
  required: ['empty', 'files', 'summary', 'diff', 'truncated'],
}

const FINDINGS_SCHEMA = {
  type: 'object',
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          file: { type: 'string' },
          line: { type: 'integer' },
          severity: { type: 'string', enum: ['P1', 'P2', 'P3'] },
          invariant: { type: 'string' },
          scenario: { type: 'string' },
        },
        required: ['file', 'line', 'severity', 'invariant', 'scenario'],
      },
    },
  },
  required: ['findings'],
}

const VERDICT_SCHEMA = {
  type: 'object',
  properties: {
    refuted: { type: 'boolean' },
    reason: { type: 'string' },
  },
  required: ['refuted', 'reason'],
}

phase('Scope')

const scope = await agent(
  [
    'Capture the current change set of this repository so a panel of reviewers can all judge the same thing.',
    `Run: \`git diff ${base}...HEAD\` (if the ref does not exist, fall back to \`git diff origin/${base}...HEAD\`, then \`git diff HEAD~1\`), plus \`git diff\` (unstaged) and \`git diff --staged\`. Untracked files are part of the change set too: list them via \`git status --porcelain\` and append each as a new-file diff (\`git diff --no-index /dev/null <path>\` — exits 1 on success, that is fine).`,
    'Return: empty=true only if ALL of those are empty; files = every changed repo-relative path (deduped); summary = one line per touched area; diff = the concatenated unified diffs. If the concatenated diff exceeds ~50,000 characters, keep the full per-file diffs for the most substantive files, replace the rest with their `git diff --stat` lines, and set truncated=true.',
  ].join('\n'),
  { label: 'scope:diff', phase: 'Scope', schema: SCOPE_SCHEMA },
)

if (!scope || scope.empty) {
  return { verdict: 'no changes to review', base }
}
log(`Reviewing ${scope.files.length} changed files vs ${base}${scope.truncated ? ' (diff truncated — reviewers Read files for full context)' : ''}`)

const applicable = REVIEWERS.filter((r) => scope.files.some((f) => r.paths.test(f)))
const skipped = REVIEWERS.filter((r) => !applicable.includes(r)).map((r) => r.key)
if (skipped.length) log(`Skipped (no changed file in domain): ${skipped.join(', ')}`)
if (!applicable.length) {
  return { verdict: 'no reviewer domain matches this change set', files: scope.files, skipped }
}

const reviewPrompt = (r) =>
  [
    `Review this change set (${scope.files.length} files) per your standing instructions. Your domain: ${r.domain}.`,
    `Changed files:\n${scope.files.join('\n')}`,
    `Diff${scope.truncated ? ' (truncated — Read the files for full context)' : ''}:\n${scope.diff}`,
    'Report ONLY defects introduced or exposed by this change set, each with the exact file, the 1-indexed line, P1/P2/P3 per your severity table, the violated invariant, and a concrete failure scenario. If nothing in your domain is wrong, return an empty findings array.',
  ].join('\n\n')

const skepticPrompt = (f, r) =>
  [
    `Adversarially verify one code-review finding. The ${r.key} claims a ${f.severity} at ${f.file}:${f.line}:`,
    `Violated invariant: ${f.invariant}`,
    `Failure scenario: ${f.scenario}`,
    'Read the file at that location (and anything it references) in the current working tree. Your job is to REFUTE the finding: the defect is only real if the code at that location, as it exists now, concretely permits the failure scenario. Default to refuted=true if the claim is speculative, already guarded elsewhere, or points at unchanged pre-existing behavior misattributed to this diff.',
  ].join('\n')

// pipeline, not a barrier: each reviewer's findings go to verification the moment that
// reviewer finishes — the fast domains don't idle behind the slow ones.
const results = await pipeline(
  applicable,
  (r) => agent(reviewPrompt(r), { label: `review:${r.key}`, phase: 'Review', schema: FINDINGS_SCHEMA, agentType: r.key }),
  (review, r) => {
    const findings = (review && review.findings) || []
    if (!findings.length) return []
    return parallel(
      findings.map((f) => () =>
        agent(skepticPrompt(f, r), { label: `verify:${f.file}:${f.line}`, phase: 'Verify', schema: VERDICT_SCHEMA }).then(
          (v) => (v && !v.refuted ? { ...f, reviewer: r.key, confirmedBecause: v.reason } : null),
        ),
      ),
    ).then((vs) => vs.filter(Boolean))
  },
)

// Deterministic merge: collapse duplicates (several lenses on one line) into a single
// entry that keeps the highest severity and names every reviewer that flagged it.
const RANK = { P1: 0, P2: 1, P3: 2 }
const merged = new Map()
for (const f of results.filter(Boolean).flat()) {
  const key = `${f.file}:${f.line}`
  const prior = merged.get(key)
  if (!prior) {
    merged.set(key, { ...f, reviewers: [f.reviewer] })
  } else {
    if (RANK[f.severity] < RANK[prior.severity]) {
      prior.severity = f.severity
      prior.invariant = f.invariant
      prior.scenario = f.scenario
    }
    if (!prior.reviewers.includes(f.reviewer)) prior.reviewers.push(f.reviewer)
  }
}
const confirmed = [...merged.values()].sort((a, b) => RANK[a.severity] - RANK[b.severity] || a.file.localeCompare(b.file))

log(`${confirmed.length} confirmed findings (${confirmed.filter((f) => f.severity === 'P1').length} P1)`)

return {
  base,
  files: scope.files,
  reviewersRun: applicable.map((r) => r.key),
  skipped,
  p1: confirmed.filter((f) => f.severity === 'P1'),
  p2: confirmed.filter((f) => f.severity === 'P2'),
  p3: confirmed.filter((f) => f.severity === 'P3'),
  next: 'Fix P1s one at a time, each as its own isolated change; re-run the owning reviewer to confirm. Then /compound anything a reviewer or test should have caught but did not.',
}
