import { describe, expect, it } from 'vitest'
import { evaluateDeskRun, mergeCandidates, pickLatestBranch } from '../../scripts/verify-desk-logic.mjs'

describe('pickLatestBranch', () => {
  it('returns null for an empty list', () => {
    expect(pickLatestBranch([])).toBeNull()
    expect(pickLatestBranch(undefined as unknown as never[])).toBeNull()
  })

  it('picks the most recently committed branch', () => {
    const branches = [
      { name: 'autopilot/2026-07-01-a', sha: 'aaa', committedAt: '2026-07-01T10:00:00Z' },
      { name: 'autopilot/2026-07-03-c', sha: 'ccc', committedAt: '2026-07-03T10:00:00Z' },
      { name: 'autopilot/2026-07-02-b', sha: 'bbb', committedAt: '2026-07-02T10:00:00Z' },
    ]
    expect(pickLatestBranch(branches)?.name).toBe('autopilot/2026-07-03-c')
  })
})

describe('mergeCandidates', () => {
  it('picks the newest-numbered PR when two open PRs share a branch name, regardless of API order', () => {
    const branches: never[] = []
    // Older PR (#101) is listed LAST — a naive "last write wins" merge (unconditional
    // overwrite in a for-loop) would pick this stale PR instead of the current one.
    const prs = [
      { number: 205, headRef: 'autopilot/2026-07-05-fix', headSha: 'new-sha', merged: false, updatedAt: '2026-07-01T00:00:00Z' },
      { number: 101, headRef: 'autopilot/2026-07-05-fix', headSha: 'old-sha', merged: false, updatedAt: '2026-07-06T00:00:00Z' },
    ]
    const [candidate] = mergeCandidates(branches, prs)
    expect(candidate.pr?.number).toBe(205)
    expect(candidate.pr?.headSha).toBe('new-sha')
  })

  it('is immune to a stale merged PR having a later updated_at than the current open PR', () => {
    // A stale closed/merged PR bumped by a late comment (later updatedAt) must not beat the
    // current, higher-numbered open PR — that would be a false all-clear (a dead PR reading
    // as "merged" while the real, current PR goes unchecked).
    const prs = [
      { number: 50, headRef: 'growth/weekly', headSha: 'stale-sha', merged: true, updatedAt: '2026-07-06T12:00:00Z' },
      { number: 90, headRef: 'growth/weekly', headSha: 'current-sha', merged: false, updatedAt: '2026-07-01T00:00:00Z' },
    ]
    const [candidate] = mergeCandidates([], prs)
    expect(candidate.pr?.number).toBe(90)
    expect(candidate.pr?.merged).toBe(false)
  })

  it('keeps the branch-list sha as the source of truth when the branch still exists', () => {
    const branches = [{ name: 'autopilot/2026-07-05-fix', sha: 'branch-sha' }]
    const prs = [{ number: 1, headRef: 'autopilot/2026-07-05-fix', headSha: 'branch-sha', merged: false, updatedAt: '2026-07-05T00:00:00Z' }]
    const [candidate] = mergeCandidates(branches, prs)
    expect(candidate.sha).toBe('branch-sha')
    expect(candidate.pr?.number).toBe(1)
  })

  it('falls back to the PR when the branch has already been deleted (post-merge)', () => {
    const prs = [{ number: 7, headRef: 'finance/sync', headSha: 'merged-sha', merged: true, updatedAt: '2026-07-04T00:00:00Z' }]
    const [candidate] = mergeCandidates([], prs)
    expect(candidate.name).toBe('finance/sync')
    expect(candidate.sha).toBe('merged-sha')
    expect(candidate.committedAt).toBe('2026-07-04T00:00:00Z')
  })
})

describe('evaluateDeskRun', () => {
  const branch = { name: 'autopilot/2026-07-05-fix', sha: 'sha123', committedAt: '2026-07-05T10:00:00Z' }

  it('fails closed when no branch exists', () => {
    const result = evaluateDeskRun(null, null, [])
    expect(result.ok).toBe(false)
    expect(result.status).toBe('no-branch')
  })

  it('fails when a branch exists but has no PR', () => {
    const result = evaluateDeskRun(branch, null, [])
    expect(result.ok).toBe(false)
    expect(result.status).toBe('no-pr')
  })

  it('fails when the PR head SHA does not match the branch HEAD', () => {
    const pr = { number: 42, headSha: 'stale-sha', merged: false }
    const result = evaluateDeskRun(branch, pr, [])
    expect(result.ok).toBe(false)
    expect(result.status).toBe('sha-mismatch')
  })

  it('passes when the PR is merged, regardless of checks', () => {
    const pr = { number: 42, headSha: 'sha123', merged: true }
    const result = evaluateDeskRun(branch, pr, [])
    expect(result.ok).toBe(true)
    expect(result.status).toBe('merged')
  })

  it('fails when an open PR has no checks reported yet', () => {
    const pr = { number: 42, headSha: 'sha123', merged: false }
    const result = evaluateDeskRun(branch, pr, [])
    expect(result.ok).toBe(false)
    expect(result.status).toBe('checks-pending')
  })

  it('fails when a check is failing', () => {
    const pr = { number: 42, headSha: 'sha123', merged: false }
    const checks = [
      { name: 'Vercel', bucket: 'pass' as const },
      { name: 'lint', bucket: 'fail' as const },
    ]
    const result = evaluateDeskRun(branch, pr, checks)
    expect(result.ok).toBe(false)
    expect(result.status).toBe('checks-red')
    expect(result.reason).toContain('lint')
  })

  it('fails (not passes) when checks are still running', () => {
    const pr = { number: 42, headSha: 'sha123', merged: false }
    const checks = [{ name: 'Vercel', bucket: 'pending' as const }]
    const result = evaluateDeskRun(branch, pr, checks)
    expect(result.ok).toBe(false)
    expect(result.status).toBe('checks-pending')
  })

  it('passes when all checks are green (pass or skipping)', () => {
    const pr = { number: 42, headSha: 'sha123', merged: false }
    const checks = [
      { name: 'Vercel', bucket: 'pass' as const },
      { name: 'optional-job', bucket: 'skipping' as const },
    ]
    const result = evaluateDeskRun(branch, pr, checks)
    expect(result.ok).toBe(true)
    expect(result.status).toBe('checks-green')
  })
})
