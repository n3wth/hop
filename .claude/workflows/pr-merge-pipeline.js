export const meta = {
  name: 'pr-merge-pipeline',
  description: 'Review a hop PR with three parallel lenses, fix any P1s on the PR branch, then merge once CI is green.',
  whenToUse:
    'Once a PR is open and ready to land. args: { pr: <number> } (required) — the GitHub PR number. Runs Review → Fix (only if P1s found) → Merge.',
  phases: [
    { title: 'Review', detail: '3 parallel reviewers over the PR diff (engine, security, style)' },
    { title: 'Adjudicate', detail: 'only if two lenses disagree about the same file/line — one fresh-evidence pass to resolve it' },
    { title: 'Fix', detail: 'apply P1 fixes on the PR branch, in a dedicated worktree, if any were found' },
    { title: 'Merge', detail: 'wait for CI, mark ready, merge-commit (ADR 0009 — matches repo history, not squash)' },
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
// Index BEFORE filtering nulls — `parallel` preserves order, so `LENSES[i]` only lines up
// with `reviews[i]` while the array is unfiltered. Filtering dead lenses out first (as the
// previous version did) shifts indices and silently mislabels a survivor's findings with a
// dead lens's key.
let p1 = reviews.flatMap((r, i) => ((r && r.p1) || []).map((f) => ({ ...f, lens: LENSES[i].key })))
const p2 = reviews.filter(Boolean).flatMap((r) => r.p2)

// Tie-break for contradictory P1s: group by exact file(+line), then flag any location where
// two DIFFERENT lenses independently landed a P1 with materially different issue text. That's
// a contradiction, not corroboration — the previous behavior here was a bare flatMap, which
// either silently kept both conflicting claims in the fix list or let the Fix agent guess
// which one to believe. Escalate once to a single adjudicating pass that re-reads the current
// PR diff/file with fresh eyes instead of trusting either lens's framing.
const byLocation = new Map()
for (const f of p1) {
  const key = `${f.file}:${f.line ?? ''}`
  if (!byLocation.has(key)) byLocation.set(key, [])
  byLocation.get(key).push(f)
}
const contested = [...byLocation.entries()].filter(([, items]) => {
  if (items.length < 2) return false
  const distinctIssues = new Set(items.map((it) => it.issue.trim().toLowerCase()))
  return distinctIssues.size > 1
})

if (contested.length > 0) {
  phase('Adjudicate')
  log(`${contested.length} contested location(s) — lenses disagree, running fresh-evidence adjudication`)
  const ADJUDICATE_SCHEMA = {
    type: 'object',
    required: ['verdict', 'issue'],
    properties: {
      verdict: { type: 'string', enum: ['upheld', 'refuted', 'reconciled'] },
      issue: { type: 'string' },
      fix: { type: 'string' },
    },
  }
  const resolutions = await parallel(
    contested.map(([key, items]) => () =>
      agent(
        [
          `Two or more reviewer lenses disagree about hop PR #${PR} at ${key}.`,
          `cd ${REPO} && gh pr diff ${PR} (and Read the referenced file at the PR branch's HEAD if you need more context).`,
          'Conflicting claims:',
          items.map((it) => `- [${it.lens}] ${it.issue}${it.fix ? ` (suggested fix: ${it.fix})` : ''}`).join('\n'),
          'Re-check the code as it actually exists right now — do not trust either lens\'s framing or defer to whichever sounds more confident. Return verdict="upheld" if exactly one claim is correct (put it in issue/fix); verdict="reconciled" if both lenses found a real but different problem at this same spot that should become one combined issue/fix; verdict="refuted" if neither claim survives contact with the current code and this location should NOT block merge.',
        ].join('\n\n'),
        { label: `adjudicate:${key}`, phase: 'Adjudicate', model: 'sonnet', schema: ADJUDICATE_SCHEMA },
      ),
    ),
  )
  const contestedKeys = new Set(contested.map(([key]) => key))
  p1 = p1.filter((f) => !contestedKeys.has(`${f.file}:${f.line ?? ''}`))
  contested.forEach(([key, items], i) => {
    const resolution = resolutions[i]
    const [file, lineStr] = [key.slice(0, key.lastIndexOf(':')), key.slice(key.lastIndexOf(':') + 1)]
    if (!resolution || resolution.verdict === 'refuted') {
      log(`Adjudication dropped contested finding at ${key} (${resolution ? 'refuted' : 'adjudicator failed'})`)
      return
    }
    p1.push({
      file,
      line: lineStr ? Number(lineStr) : undefined,
      issue: resolution.issue,
      fix: resolution.fix,
      lens: `adjudicated(${items.map((it) => it.lens).join(',')})`,
    })
  })
}

log(`${p1.length} P1, ${p2.length} P2`)

if (p1.length > 0) {
  phase('Fix')
  await agent(
    `Fix these P1 findings on hop PR #${PR}. cd ${REPO} && gh pr checkout ${PR} into a worktree: BR=$(gh pr view ${PR} --json headRefName -q .headRefName); git fetch origin $BR && git worktree add /tmp/hop-fix-pr${PR} $BR (if worktree exists, reuse it and pull). Findings: ${JSON.stringify(p1)}. Apply minimal fixes, run npm run check (must pass), commit on the SAME branch (verify with git branch --show-current chained into the commit command; co-author trailer "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"), push. If a finding is wrong, skip it and say why. Return what you fixed/skipped.`,
    { label: 'fix-p1s', phase: 'Fix' },
  )
}

phase('Merge')
// main's branch protection does not require a PR to be up to date with main before merging
// (required_status_checks.strict is false — docs/agent-playbook.md §1.5), so two desks
// merging minutes apart can each show a green check against a main that's already stale by
// the time they land. Updating the branch and re-waiting on checks immediately before the
// merge call is the repo-side substitute for that missing platform guarantee.
const merged = await agent(
  `Merge hop PR #${PR} once green. cd ${REPO}. Steps: gh pr checks ${PR} --watch (up to 15 min; if no checks configured, verify npm run check passed per PR conversation or run it in a worktree of the head branch). If checks fail, do NOT merge — return the failure verbatim. Then, immediately before merging: gh pr update-branch ${PR} (brings the branch up to date with main; ignore "already up to date" errors), then gh pr checks ${PR} --watch again to confirm the re-run is green (if update-branch changed nothing, this is a fast no-op re-check). Only then: gh pr ready ${PR} (ignore error if already ready), then gh pr merge ${PR} --merge --delete-branch (merge-commit, per ADR 0009 — matches repo history; NOT --squash). Return "MERGED <sha>" or the blocking failure.`,
  { label: 'merge', phase: 'Merge', model: 'haiku' },
)

return { pr: PR, p1_found: p1.length, p2_deferred: p2, merge_result: merged }
