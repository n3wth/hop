export const meta = {
  name: 'invariant-audit',
  description:
    "Standing audit: sweep the whole codebase (not a diff) against hop's six invariant domains plus the memory surfaces, loop until two consecutive rounds find nothing new, and adversarially verify every finding with a three-skeptic panel.",
  whenToUse:
    'Periodically, or before a milestone — when the question is "has anything drifted?" rather than "is this diff good?". args: { focus?: string } narrows the sweep (e.g. "eve/", "lib/standing-orders").',
  phases: [
    { title: 'Find', detail: 'seven finder lenses sweep the codebase, blind to each other' },
    { title: 'Verify', detail: 'three perspective-diverse skeptics per fresh finding; majority confirms' },
  ],
}

// Unknown-size discovery: a fixed finder count misses the tail, so this loops until dry.
// Dedup is against everything ever SEEN (not just confirmed) — otherwise skeptic-rejected
// findings reappear every round and the loop never converges.

const focus = (args && args.focus) || ''
const scopeNote = focus ? ` Focus the sweep on ${focus} (still report cross-boundary leaks that involve it).` : ''

// The six reviewer domains as codebase-wide sweeps, plus a seventh lens for the memory
// surfaces that ADR 0004 makes load-bearing.
const LENSES = [
  { key: 'engine', agentType: 'engine-invariant-reviewer', sweep: 'every surfaced economic number traces to lib/*; no re-implemented cpp/tier math or hardcoded 2.5/3.0/1.5 thresholds outside lib/cpp.ts; no LLM prompt that invites the model to compute or estimate a figure' },
  { key: 'degradation', agentType: 'degradation-reviewer', sweep: 'no lib/* client or DB path that can throw to a page/route/agent; every query goes through withDb; every consumer of a degradable source checks degraded[]/{ok:false} before rendering confidence' },
  { key: 'copy', agentType: 'copy-voice-reviewer', sweep: 'user-facing copy holds the copy-spec voice; no shadows/gradients/glows; tokens over hardcoded hex; motion gated behind prefers-reduced-motion' },
  { key: 'nextjs16', agentType: 'nextjs16-reviewer', sweep: 'framework usage matches Next.js 16.2.9 + React 19 per node_modules/next/dist/docs — sync access to async params/searchParams, stale caching idioms, pre-16 handler shapes' },
  { key: 'eve', agentType: 'eve-architecture-reviewer', sweep: 'Eve tools wrap lib/* without duplicating economics; every proactive seam is flag-gated and no-ops cleanly; deliveries dedupe; irreversible actions are human-gated' },
  { key: 'security', agentType: 'security-reviewer', sweep: 'every withDb query is user_id-scoped; hop_ tokens hashed; env read lazily via lib/env.ts; no secret can reach a log, response, or client bundle; routes and cron endpoints check authz' },
  { key: 'memory', agentType: null, sweep: 'the compound loop itself: docs/solutions/ index table matches the files on disk; no code change has quietly contradicted an Accepted ADR in docs/decisions/; no solved problem in docs/solutions/ has been reintroduced in the code it names; CLAUDE.md claims still match the repo (paths, commands, flags)' },
]

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

const finderPrompt = (lens, round, seenKeys) =>
  [
    `Audit the CURRENT state of this repository (the whole codebase, not a diff) for violations of: ${lens.sweep}.${scopeNote}`,
    round > 1
      ? `This is round ${round}. Everything below has already been found — do NOT repeat it; hunt for what earlier rounds missed (different directories, different file types, the tail):\n${seenKeys.join('\n')}`
      : 'This is round 1 — sweep broadly.',
    'Report each violation with the exact file, 1-indexed line, P1/P2/P3 severity, the violated invariant, and a concrete failure scenario. Only report what you actually verified by reading the code. If the domain is clean, return an empty findings array.',
  ].join('\n\n')

const SKEPTIC_ANGLES = [
  'correctness: does the code at that exact location actually permit the failure scenario as written',
  'impact: even if technically true, does it break an invariant users or agents depend on, or is it inert',
  'freshness: is this a live defect in the current tree, not something already guarded, flagged off, or documented as accepted',
]

const seen = new Set()
const confirmed = []
let round = 0
let dry = 0
const MAX_ROUNDS = 4 // hard backstop, logged below if it binds — not a silent cap

while (dry < 2 && round < MAX_ROUNDS) {
  if (budget.total && budget.remaining() < 60000) {
    log(`Stopping: token budget nearly spent after round ${round} (${Math.round(budget.remaining() / 1000)}k left)`)
    break
  }
  round += 1
  phase(`Find (round ${round})`)

  // Barrier per round is deliberate: dedup below needs every lens's findings at once.
  const found = (
    await parallel(
      LENSES.map((lens) => () =>
        agent(finderPrompt(lens, round, [...seen]), {
          label: `find:${lens.key}:r${round}`,
          phase: `Find (round ${round})`,
          schema: FINDINGS_SCHEMA,
          ...(lens.agentType ? { agentType: lens.agentType } : {}),
        }).then((r) => ((r && r.findings) || []).map((f) => ({ ...f, lens: lens.key }))),
      ),
    )
  )
    .filter(Boolean)
    .flat()

  const fresh = found.filter((f) => !seen.has(`${f.file}:${f.line}`))
  if (!fresh.length) {
    dry += 1
    log(`Round ${round}: nothing new (${dry}/2 dry rounds)`)
    continue
  }
  dry = 0
  fresh.forEach((f) => seen.add(`${f.file}:${f.line}`))
  log(`Round ${round}: ${fresh.length} fresh findings to verify`)

  const judged = (
    await parallel(
      fresh.map((f) => () =>
        parallel(
          SKEPTIC_ANGLES.map((angle, i) => () =>
            agent(
              [
                `Adversarially verify one audit finding through a single lens — ${angle}.`,
                `The ${f.lens} lens claims a ${f.severity} at ${f.file}:${f.line}: ${f.scenario} (violates: ${f.invariant}).`,
                'Read the code. Default to refuted=true unless your lens concretely holds.',
              ].join('\n'),
              // skeptics inherit the session model at high effort; finder lenses run on the
              // model pinned in their reviewer frontmatter — cheap wide, strong narrow
              { label: `verify:${f.file}:${f.line}:${i + 1}`, phase: `Verify (round ${round})`, schema: VERDICT_SCHEMA, effort: 'high' },
            ),
          ),
        ).then((vs) => {
          const kept = vs.filter(Boolean)
          const upheld = kept.filter((v) => !v.refuted).length
          return upheld >= 2 ? { ...f, skepticVotes: `${upheld}/${kept.length}` } : null
        }),
      ),
    )
  ).filter(Boolean)

  confirmed.push(...judged)
  log(`Round ${round}: ${judged.length}/${fresh.length} survived the skeptic panel`)
}

if (round >= MAX_ROUNDS && dry < 2) log(`Stopped at the ${MAX_ROUNDS}-round backstop without going dry — the tail may not be exhausted.`)

const RANK = { P1: 0, P2: 1, P3: 2 }
confirmed.sort((a, b) => RANK[a.severity] - RANK[b.severity] || a.file.localeCompare(b.file))

return {
  focus: focus || 'whole repo',
  rounds: round,
  exhausted: dry >= 2,
  examined: seen.size,
  confirmed,
  next: 'Fix P1s one at a time; /compound every confirmed finding — an invariant that drifted silently is exactly the lesson the loop exists to capture.',
}
