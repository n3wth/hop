export const meta = {
  name: 'plan-panel',
  description:
    'Plan lane, panel mode: three independent blueprints from different lenses (engine-first, risk-first, surface-first), a judge panel scores them, one synthesis grafts the best ideas into a single docs/plans/ file.',
  whenToUse:
    'When the solution space is wide or contested — a new seam, a cross-cutting feature, anything where the first plan you think of is probably not the best one. For a narrow, well-trodden change, plain /plan is cheaper. args: { task: string, slug?: string }.',
  phases: [
    { title: 'Draft', detail: 'three planners research the repo independently, one blueprint per lens' },
    { title: 'Judge', detail: 'three judges score every draft against the plan rubric' },
    { title: 'Synthesize', detail: 'winning draft + grafted ideas written to docs/plans/' },
  ],
}

// A judge panel beats one-attempt-iterated when the solution space is wide: diversity in
// the drafts is the point, so each planner researches alone and never sees the others.

// Some callers deliver `args` as a JSON-encoded string rather than an object — parse
// defensively or every knob silently falls back to its default.
let input = args || {}
if (typeof input === 'string') {
  try {
    input = JSON.parse(input)
  } catch {
    // a bare string is a usable task description
    input = { task: input }
  }
}

const task = input.task
if (!task) {
  return { error: 'plan-panel needs args.task — the feature or bug to plan, in a sentence.' }
}

const LENSES = [
  {
    key: 'engine-first',
    brief:
      'Start from the lib/* engine seam: which existing functions already carry this (assembleSearch, priceTrip, getUserBalances, evaluateOrder, cpp/tier), what is the smallest mechanical Work lane, where do computed numbers enter.',
  },
  {
    key: 'risk-first',
    brief:
      'Start from failure: what breaks, how each new client/query degrades ({ok:false}, withDb, degraded[]), which flag gates the seam and how it no-ops when off, user_id scoping, idempotency, anything irreversible that needs a human gate.',
  },
  {
    key: 'surface-first',
    brief:
      'Start from what the user sees: the surface, the copy (copy-spec voice — state the answer and the number), the empty/degraded states, then work backwards to the engine calls that make every rendered number computed.',
  },
]

const JUDGE_SCHEMA = {
  type: 'object',
  properties: {
    ranking: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          lens: { type: 'string' },
          score: { type: 'integer', minimum: 0, maximum: 10 },
          weaknesses: { type: 'string' },
        },
        required: ['lens', 'score', 'weaknesses'],
      },
    },
    winner: { type: 'string' },
    grafts: { type: 'string' },
  },
  required: ['ranking', 'winner', 'grafts'],
}

const SYNTH_SCHEMA = {
  type: 'object',
  properties: {
    path: { type: 'string' },
    summary: { type: 'string' },
  },
  required: ['path', 'summary'],
}

phase('Draft')

const draftPrompt = (lens) =>
  [
    `You are in hop's Plan lane. Produce a complete implementation blueprint for: ${task}`,
    `Your lens (commit to it — the panel needs genuinely different plans): ${lens.brief}`,
    'First read .claude/commands/plan.md and follow its §1 research discipline exactly: CLAUDE.md + AGENTS.md, the engine seam, prior art in docs/plans/, solved problems in docs/solutions/, ADRs in docs/decisions/, and the relevant node_modules/next/dist/docs/ guide if the work is framework-level.',
    'Then write the blueprint with all ten sections from plan.md §2 (title/status, requirements, files-to-touch table, engine hooks, flags & seams, degradation plan, test plan, copy & design notes, risks, review hooks).',
    'Do NOT write any file. Your final message must be ONLY the blueprint markdown, nothing else.',
  ].join('\n\n')

const drafts = (
  await parallel(
    LENSES.map((lens) => () =>
      agent(draftPrompt(lens), { label: `draft:${lens.key}`, phase: 'Draft' }).then((text) => (text ? { lens: lens.key, text } : null)),
    ),
  )
).filter(Boolean)

if (!drafts.length) {
  return { error: 'all planners failed — nothing to judge' }
}

// Barrier is correct here: every judge must see ALL drafts to compare them.
phase('Judge')

const judgePrompt = (angle) =>
  [
    `Judge ${drafts.length} competing implementation blueprints for: ${task}`,
    `Your judging angle: ${angle}.`,
    'Rubric (score each draft 0–10): preserves the non-negotiable invariants (engine-computed numbers, graceful degradation, flag-gated seams, user_id scoping); files-to-touch names exact paths; flags/degradation/test plans are concrete enough to execute mechanically; the Work lane is genuinely small; non-goals and risks are honest. Verify claims against the actual repo where they matter — do not score prose style.',
    ...drafts.map((d) => `--- DRAFT [${d.lens}] ---\n${d.text}`),
    'Return the ranking, the winning lens, and grafts: the specific ideas from the losing drafts that the winner should absorb.',
  ].join('\n\n')

const JUDGE_ANGLES = [
  'correctness — would this plan produce code that violates an invariant or an accepted ADR',
  'executability — could an agent implement the Work lane from this plan alone, without re-research',
  'economy — is anything in this plan speculative scope the requirements do not need',
]

// Judges inherit the session model at high effort: scoring competing plans against the
// invariants is the hardest judgment node in this workflow — drafts stay at session default.
const verdicts = (
  await parallel(
    JUDGE_ANGLES.map((angle, i) => () => agent(judgePrompt(angle), { label: `judge:${i + 1}`, phase: 'Judge', schema: JUDGE_SCHEMA, effort: 'high' })),
  )
).filter(Boolean)

if (!verdicts.length) {
  return { error: 'all judges failed', drafts: drafts.map((d) => d.lens) }
}

// Deterministic tally: majority of winner votes, total score as tiebreak.
const votes = {}
const totals = {}
for (const v of verdicts) {
  votes[v.winner] = (votes[v.winner] || 0) + 1
  for (const r of v.ranking) totals[r.lens] = (totals[r.lens] || 0) + r.score
}
const winnerLens = Object.keys(votes).sort((a, b) => votes[b] - votes[a] || (totals[b] || 0) - (totals[a] || 0))[0]
const winner = drafts.find((d) => d.lens === winnerLens) || drafts[0]
log(`Winner: ${winner.lens} (votes: ${JSON.stringify(votes)}, scores: ${JSON.stringify(totals)})`)

phase('Synthesize')

const synthesis = await agent(
  [
    `Synthesize the final implementation blueprint for: ${task}`,
    `The winning draft (lens: ${winner.lens}) is below. Keep its spine. Fold in the judges' grafts and repair their named weaknesses — graft ideas, do not average the plans into mush.`,
    `--- WINNING DRAFT ---\n${winner.text}`,
    ...verdicts.map((v, i) => `--- JUDGE ${i + 1} ---\nweaknesses: ${JSON.stringify(v.ranking)}\ngrafts: ${v.grafts}`),
    `Write the result to docs/plans/<date>-<slug>.md — get <date> from \`date +%F\`, slug ${input.slug ? `is "${input.slug}"` : 'is a short kebab-case summary of the task'}. Keep the ten-section structure from .claude/commands/plan.md §2 and mark it \`> Plan. Status: proposal.\` Return the repo-relative path and a 3-line summary.`,
  ].join('\n\n'),
  { label: 'synthesize', phase: 'Synthesize', schema: SYNTH_SCHEMA },
)

return {
  task,
  planPath: synthesis && synthesis.path,
  summary: synthesis && synthesis.summary,
  winner: winner.lens,
  votes,
  scores: totals,
  next: 'Read the plan, adjust by hand if needed, then implement against it; /review-parallel the diff; /compound the lessons.',
}
