import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

// .claude/workflows/review-parallel.js is a Workflow-tool sandbox script (plain JS, no
// import/export beyond `meta`, globals injected at run time — see .claude/workflows/README.md
// "Constraints"), so it cannot be `import`ed like a normal module. Its finding-merge logic
// (RANK + mergeFindings, including the isNewClaim fix) is bracketed with `test:extract`
// marker comments specifically so this test can slice out and evaluate the REAL shipped
// source — never a hand-copied duplicate that could silently drift from production.
function loadMergeFindings() {
  const file = path.join(__dirname, '../../.claude/workflows/review-parallel.js')
  const source = readFileSync(file, 'utf8')
  const start = source.indexOf('// test:extract-start')
  const end = source.indexOf('// test:extract-end')
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('review-parallel.js: test:extract markers not found — did the merge block move or get renamed?')
  }
  const body = source.slice(start, end)
  const factory = new Function(`${body}\nreturn mergeFindings;`)
  return factory() as (findings: unknown[]) => Map<string, { severity: string; reviewers: string[]; variants: unknown[] }>
}

describe('review-parallel.js mergeFindings / isNewClaim', () => {
  it('catches a finding that duplicates variants[1] even though it differs from variants[0] (the exact bug)', () => {
    const mergeFindings = loadMergeFindings()
    const findings = [
      // variants[0]
      { file: 'lib/search.ts', line: 42, severity: 'P2', invariant: 'invariant-A', scenario: 'scenario-A', reviewer: 'reviewer-a' },
      // variants[1] — a genuinely distinct claim at the same location
      { file: 'lib/search.ts', line: 42, severity: 'P1', invariant: 'invariant-B', scenario: 'scenario-B', reviewer: 'reviewer-b' },
      // duplicate of variants[1], NOT variants[0] — a same-only-variants[0] comparison
      // would wrongly treat this as new and append a 3rd (duplicate) variant
      { file: 'lib/search.ts', line: 42, severity: 'P1', invariant: 'invariant-B', scenario: 'scenario-B', reviewer: 'reviewer-c' },
    ]
    const merged = mergeFindings(findings)
    const entry = merged.get('lib/search.ts:42')
    expect(entry).toBeDefined()
    expect(entry!.variants).toHaveLength(2)
    // The duplicate's reviewer is still recorded as having flagged the location, even
    // though it didn't add a new variant.
    expect(entry!.reviewers).toEqual(['reviewer-a', 'reviewer-b', 'reviewer-c'])
    expect(entry!.severity).toBe('P1')
  })

  it('still tracks a genuinely new 3rd variant', () => {
    const mergeFindings = loadMergeFindings()
    const findings = [
      { file: 'lib/cpp.ts', line: 10, severity: 'P3', invariant: 'A', scenario: 'a', reviewer: 'r1' },
      { file: 'lib/cpp.ts', line: 10, severity: 'P3', invariant: 'B', scenario: 'b', reviewer: 'r2' },
      { file: 'lib/cpp.ts', line: 10, severity: 'P2', invariant: 'C', scenario: 'c', reviewer: 'r3' },
    ]
    const merged = mergeFindings(findings)
    const entry = merged.get('lib/cpp.ts:10')
    expect(entry!.variants).toHaveLength(3)
    expect(entry!.severity).toBe('P2')
  })

  it('collapses exact duplicates (same invariant+scenario) from multiple reviewers into one variant', () => {
    const mergeFindings = loadMergeFindings()
    const findings = [
      { file: 'app/page.tsx', line: 5, severity: 'P1', invariant: 'X', scenario: 'y', reviewer: 'r1' },
      { file: 'app/page.tsx', line: 5, severity: 'P1', invariant: 'X', scenario: 'y', reviewer: 'r2' },
    ]
    const merged = mergeFindings(findings)
    const entry = merged.get('app/page.tsx:5')
    expect(entry!.variants).toHaveLength(1)
    expect(entry!.reviewers).toEqual(['r1', 'r2'])
  })
})
