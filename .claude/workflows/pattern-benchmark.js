export const meta = {
  name: 'pattern-benchmark',
  description:
    "Benchmark each pattern in docs/meta/ against current best-in-class and novel proven external practice, and apply the concrete improvements found — keeps the portable pattern library from calcifying into 'how hop happened to do it once'.",
  whenToUse:
    'Periodically (quarterly is reasonable), or after a pattern doc feels stale — when the question is "is this still the best known way to do this, or just the first way we found?". args: { focus?: string } narrows to one pattern by slug (e.g. "05-tiered-auto-merge"); omit to sweep all ten.',
  phases: [
    { title: 'Research', detail: 'one research pass per pattern: web search for current best-in-class/novel practice, compared against the doc as written' },
    { title: 'Apply', detail: 'only for patterns where research found a concrete, sourced improvement — the doc is edited in place, citations kept' },
  ],
}

// The pattern library (doc 01) exists so hop's process ports elsewhere. That only holds if
// the patterns stay current — a doc that describes "how we solved this once" and never
// checks the outside world quietly drifts into local optimum. This workflow is the check:
// it does NOT trust its own research blindly (a hallucinated "best practice" would be worse
// than no update), so the apply stage only fires on a sourced, concrete recommendation, and
// every applied edit keeps its citation inline for the next reader to verify.

// Some callers deliver `args` as a JSON-encoded string rather than an object — parse
// defensively or every knob silently falls back to its default.
let input = args || {}
if (typeof input === 'string') {
  try {
    input = JSON.parse(input)
  } catch {
    input = { focus: input }
  }
}

const ALL_PATTERNS = [
  { slug: '01-principles', file: 'docs/meta/01-principles.md', topic: 'compound engineering loops for AI coding agents: capturing lessons so they auto-fire next time, and computing deterministic values outside the model rather than trusting the LLM to get arithmetic/state right' },
  { slug: '02-isolated-workspaces', file: 'docs/meta/02-isolated-workspaces.md', topic: 'isolated/disposable workspace patterns for parallel AI coding agents (git worktrees, sandboxes, container-per-task) and how teams prevent agents from colliding on trunk' },
  { slug: '03-pr-pipeline', file: 'docs/meta/03-pr-pipeline.md', topic: 'one-task-one-PR pipelines for AI-generated code: CI wiring, preview deployments, and automatic machine review attached to every PR' },
  { slug: '04-machine-review', file: 'docs/meta/04-machine-review.md', topic: 'automated/LLM-based code review systems: specialized reviewer agents, schema-typed findings, adversarial or skeptic-verification passes that reduce false-positive review findings' },
  { slug: '05-tiered-auto-merge', file: 'docs/meta/05-tiered-auto-merge.md', topic: 'autonomous merge policies for AI agents: merge predicates, path-based hold lists for sensitive code, kill switches, and how much human-in-the-loop is typical at different maturity levels' },
  { slug: '06-autonomy-runbook', file: 'docs/meta/06-autonomy-runbook.md', topic: 'runbook/playbook patterns that unattended autonomous agent fleets read on every run, and how organizations version and amend the rules that govern unattended agents' },
  { slug: '07-compounding-memory', file: 'docs/meta/07-compounding-memory.md', topic: 'memory and lessons-learned systems for AI coding agents across sessions: solved-problem libraries, rules files, ADRs, and how agentic systems avoid re-solving or re-breaking the same thing' },
  { slug: '08-self-healing', file: 'docs/meta/08-self-healing.md', topic: 'self-healing systems: automatic health detection, auto-filed work items from failures, and triage-before-building patterns in both classic SRE practice and newer AI-agent-operated systems' },
  { slug: '09-porting-guide', file: 'docs/meta/09-porting-guide.md', topic: 'staged-adoption playbooks for introducing an AI-agent-driven development process into an existing large codebase or monorepo (e.g. google3-style), including common adoption failure modes' },
  { slug: '10-single-source-of-truth', file: 'docs/meta/10-single-source-of-truth.md', topic: 'single-source-of-truth / DRY documentation patterns for engineering orgs and how they detect or prevent restated facts (architecture, config, schedules) forking silently across docs, wikis, or agent instructions' },
]

const focus = (input.focus || '').trim()
const PATTERNS = focus ? ALL_PATTERNS.filter((p) => p.slug.includes(focus) || p.file.includes(focus)) : ALL_PATTERNS

if (!PATTERNS.length) {
  return { error: `pattern-benchmark: no pattern matches focus "${focus}". Known slugs: ${ALL_PATTERNS.map((p) => p.slug).join(', ')}` }
}

const RESEARCH_SCHEMA = {
  type: 'object',
  properties: {
    currentApproach: { type: 'string', description: "One or two sentences: what hop's doc currently prescribes." },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          practice: { type: 'string', description: 'The external practice or technique, named concretely.' },
          source: { type: 'string', description: 'A real URL returned by search. Never invent one.' },
          comparison: { type: 'string', description: "How it differs from, validates, or improves on hop's documented approach." },
        },
        required: ['practice', 'source', 'comparison'],
      },
    },
    worthApplying: { type: 'boolean', description: 'True only if a finding is concrete enough to write into the doc as an actionable improvement, not just interesting trivia.' },
    recommendedEdit: { type: 'string', description: 'If worthApplying, the exact markdown section to add (heading + prose + inline source links). Empty string otherwise.' },
    outOfScopeIdea: { type: 'string', description: "A genuinely novel idea surfaced by research that does not fit this doc's scope — candidate for a future pattern doc. Empty string if none." },
  },
  required: ['currentApproach', 'findings', 'worthApplying', 'recommendedEdit', 'outOfScopeIdea'],
}

const APPLY_SCHEMA = {
  type: 'object',
  properties: {
    applied: { type: 'boolean' },
    summary: { type: 'string', description: 'One line: what changed in the file.' },
  },
  required: ['applied', 'summary'],
}

const researchPrompt = (p) =>
  [
    `You are benchmarking one pattern in hop's portable agentic-development pattern library against the outside world.`,
    `Read ${p.file} in full first — it documents hop's current approach to: ${p.topic}.`,
    `Then use web search (and fetch specific pages if a search result needs more than the snippet) to find CURRENT, CONCRETE best-in-class or novel proven practice for the same problem — from other engineering orgs' public engineering blogs, papers, well-known OSS projects, or documented practices at AI-coding-agent companies. You are looking for genuinely comparable prior art, not generic advice.`,
    'Rules: every finding needs a real source URL from an actual search/fetch result — never invent one, never cite from memory. If search turns up nothing concretely comparable, return an empty findings array and worthApplying: false rather than padding with generic best-practices filler.',
    `worthApplying is true ONLY if you have a specific, sourced technique that hop's doc is currently missing or could do better — not "this confirms what we already do" (log that as a finding but leave worthApplying false unless the confirmation itself is worth citing as external validation).`,
    `If worthApplying, draft recommendedEdit as a new markdown subsection (pick a heading like "## External validation" or a specific technique name) written in the doc's existing terse, concrete voice — no marketing language, cite the source inline as a markdown link. It must be ready to paste in, not a summary of what someone else should write.`,
    `If you find something interesting but out of scope for THIS doc's topic, put it in outOfScopeIdea instead of forcing it into recommendedEdit.`,
    'Do not edit any file. Return only the schema.',
  ].join('\n\n')

const applyPrompt = (p, r) =>
  [
    `Apply a sourced improvement to hop's pattern doc ${p.file}.`,
    `Read the file first. Append the following section at the end of the file (before any final horizontal rule if one exists, otherwise at the end), preserving the file's existing structure and heading levels — do not rewrite unrelated content:`,
    '--- SECTION TO ADD ---',
    r.recommendedEdit,
    '--- END SECTION ---',
    `Run \`date +%F\` and prefix the section with a one-line note: "_Benchmarked against external practice on <date>._" above the heading, unless the file already has such a note from today.`,
    'Save the file. Return applied: true and a one-line summary of what you added. If the file already contains substantially the same section (re-run on an unchanged doc), return applied: false and say why instead of duplicating it.',
  ].join('\n\n')

phase('Research')

const results = await pipeline(
  PATTERNS,
  (p) => agent(researchPrompt(p), { label: `research:${p.slug}`, phase: 'Research', schema: RESEARCH_SCHEMA }),
  async (r, p) => {
    if (!r) {
      log(`${p.slug}: research failed — skipped`)
      return { slug: p.slug, file: p.file, applied: false, research: null }
    }
    if (!r.worthApplying) {
      log(`${p.slug}: no actionable external finding — left as-is (${r.findings.length} findings reviewed)`)
      return { slug: p.slug, file: p.file, applied: false, research: r }
    }
    phase('Apply')
    const applyResult = await agent(applyPrompt(p, r), { label: `apply:${p.slug}`, phase: 'Apply', schema: APPLY_SCHEMA })
    if (!applyResult || !applyResult.applied) {
      log(`${p.slug}: apply stage did not write a change (${applyResult ? applyResult.summary : 'agent failed'})`)
    }
    return { slug: p.slug, file: p.file, applied: !!(applyResult && applyResult.applied), applySummary: applyResult && applyResult.summary, research: r }
  },
)

const applied = results.filter((r) => r && r.applied)
const outOfScope = results.filter((r) => r && r.research && r.research.outOfScopeIdea).map((r) => ({ slug: r.slug, idea: r.research.outOfScopeIdea }))

if (outOfScope.length) {
  log(`${outOfScope.length} out-of-scope idea(s) surfaced — not applied anywhere, review manually: ${outOfScope.map((o) => o.slug).join(', ')}`)
}

return {
  patternsChecked: PATTERNS.length,
  applied: applied.map((r) => ({ slug: r.slug, file: r.file, summary: r.applySummary })),
  unchanged: results.filter((r) => r && !r.applied).map((r) => r.slug),
  outOfScopeIdeas: outOfScope,
  next: applied.length
    ? 'Review the diff in docs/meta/, then commit — each applied section carries its own source citations for verification.'
    : 'No pattern needed a change this run; the library still matches current external practice as far as this sweep found.',
}
