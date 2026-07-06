export const meta = {
  name: 'pr-merge-pipeline',
  description: 'Review a hop PR with three parallel lenses, fix any P1s on the PR branch, then merge once CI is green.',
  whenToUse:
    'Once a PR is open and ready to land. args: { pr: <number> } (required) — the GitHub PR number. Runs Review → Fix (only if P1s found) → Merge.',
  phases: [
    { title: 'Review', detail: '3 parallel reviewers over the PR diff (engine, security, style)' },
    { title: 'Fix', detail: 'apply P1 fixes on the PR branch, in a dedicated worktree, if any were found' },
    { title: 'Merge', detail: 'wait for CI, mark ready, squash-merge' },
  ],
}

// Orchestration is deterministic (ADR 0006): this script decides who reviews, what they see,
// and whether a fix pass runs at all. The agents supply judgment inside each node — nothing else.

// `args` may arrive as a JSON-encoded string depending on the caller — parse defensively or
// the required `pr` field silently comes back undefined.
let input = args || {}
if (typeof input === 'string') {
  try {
    input = JSON.parse(input)
  } catch {
    input = {}
  }
}
const PR = input.pr
if (!PR) throw new Error('pass args {pr: <number>}')
const REPO = '/Users/oliver/GitHub/hop'

const FINDINGS_SCHEMA = {
  type: 'object',
  required: ['p1', 'p2'],
  properties: {
    p1: {
      type: 'array',
      items: {
        type: 'object',
        required: ['file', 'issue'],
        properties: { file: { type: 'string' }, line: { type: 'number' }, issue: { type: 'string' }, fix: { type: 'string' } },
      },
    },
    p2: {
      type: 'array',
      items: { type: 'object', required: ['file', 'issue'], properties: { file: { type: 'string' }, issue: { type: 'string' } } },
    },
  },
}

// Three fixed lenses rather than the six standing .claude/agents/* reviewers (review-parallel.js)
// — this pipeline reviews a PR by number from outside any local diff/worktree context, so each
// lens re-fetches the diff itself instead of sharing one captured scope.
const LENSES = [
  {
    key: 'engine',
    prompt:
      'engine invariants (every economic number computed by lib/*, never LLM-generated), correctness of logic, and graceful degradation (clients/withDb return {ok:false}/fallbacks, never throw to a page/route)',
  },
  {
    key: 'security',
    prompt:
      'security: user_id scoping on every withDb/DB query, token hashing, no secrets in client bundles, route authz (owner/admin gating, CRON_SECRET), no plaintext leaks',
  },
  {
    key: 'style',
    prompt:
      'Next.js 16.2.9 + React 19 correctness (verify against node_modules/next/dist/docs/ when unsure, not training data), flat-editorial design rules (no shadows/gradients/hover movement), and copy voice per docs/design/copy-spec.md',
  },
]

phase('Review')
log(`Reviewing PR #${PR}`)
const reviews = await parallel(
  LENSES.map((l) => () =>
    agent(
      `Review hop PR #${PR}. cd ${REPO} && gh pr view ${PR} --json title,body,headRefName && gh pr diff ${PR}. Focus ONLY on: ${l.prompt}. Read surrounding repo files as needed for context. P1 = must fix before merge (real bug/violation with concrete failure). P2 = nice-to-have. Be skeptical of your own findings — only report P1s you can defend with file:line evidence. Empty arrays are a fine answer.`,
      { label: `review:${l.key}`, phase: 'Review', model: 'sonnet', schema: FINDINGS_SCHEMA },
    ),
  ),
)
const p1 = reviews.filter(Boolean).flatMap((r) => r.p1)
const p2 = reviews.filter(Boolean).flatMap((r) => r.p2)
log(`${p1.length} P1, ${p2.length} P2`)

if (p1.length > 0) {
  phase('Fix')
  await agent(
    `Fix these P1 findings on hop PR #${PR}. cd ${REPO} && gh pr checkout ${PR} into a worktree: BR=$(gh pr view ${PR} --json headRefName -q .headRefName); git fetch origin $BR && git worktree add /tmp/hop-fix-pr${PR} $BR (if worktree exists, reuse it and pull). Findings: ${JSON.stringify(p1)}. Apply minimal fixes, run npm run check (must pass), commit on the SAME branch (verify with git branch --show-current chained into the commit command; co-author trailer "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"), push. If a finding is wrong, skip it and say why. Return what you fixed/skipped.`,
    { label: 'fix-p1s', phase: 'Fix' },
  )
}

phase('Merge')
const merged = await agent(
  `Merge hop PR #${PR} once green. cd ${REPO}. Steps: gh pr checks ${PR} --watch (up to 15 min; if no checks configured, verify npm run check passed per PR conversation or run it in a worktree of the head branch). If checks fail, do NOT merge — return the failure verbatim. Otherwise: gh pr ready ${PR} (ignore error if already ready), then gh pr merge ${PR} --squash --delete-branch. Return "MERGED <sha>" or the blocking failure.`,
  { label: 'merge', phase: 'Merge', model: 'haiku' },
)

return { pr: PR, p1_found: p1.length, p2_deferred: p2, merge_result: merged }
