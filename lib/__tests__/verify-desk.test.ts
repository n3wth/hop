import { describe, expect, it } from 'vitest'
import { evaluateDeskRun, pickLatestBranch } from '../../scripts/verify-desk-logic.mjs'

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
