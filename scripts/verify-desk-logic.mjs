// Pure decision logic for scripts/verify-desk-run.mjs — no I/O, no `gh`/`git` calls, so it
// can be unit-tested directly (see lib/__tests__/verify-desk.test.ts) without a GitHub token
// or network access. The script that shells out to `gh` is a thin wrapper around this.
//
// Fail-closed by design (matching .claude/workflows/review-parallel.js's convention): the
// only two outcomes that count as verified are a checked-in merge or all-green CI. Anything
// else — no branch, no PR, a PR pointing at a stale SHA, missing/pending/red checks — is
// reported as unverified rather than assumed fine. The incident this addresses is a desk
// narrating success while its actual push (or PR, or CI) silently failed.

/**
 * @typedef {{ name: string, sha: string, committedAt: string }} BranchInfo
 * @typedef {{ number: number, headSha: string, merged: boolean }} PrInfo
 * @typedef {{ name: string, bucket: 'pass'|'fail'|'pending'|'skipping'|'cancel' }} CheckInfo
 */

/**
 * Pick the most recently committed branch from a list of candidates matching a prefix.
 * @param {BranchInfo[]} branches
 * @returns {BranchInfo | null}
 */
export function pickLatestBranch(branches) {
  if (!branches || branches.length === 0) return null
  return [...branches].sort((a, b) => (a.committedAt < b.committedAt ? 1 : a.committedAt > b.committedAt ? -1 : 0))[0]
}

/**
 * Merge independently-fetched branch and PR lists into one candidate per branch name,
 * matched by head ref (see scripts/verify-desk-run.mjs#fetchCandidates for why the PR list
 * is authoritative: a self-merging desk's PR is created with `--delete-branch`, so after a
 * healthy merge the branch is gone and the PR is the only surviving record).
 *
 * Multiple PRs can share the same head ref — a branch name reused across desk runs, or a
 * stale closed/merged PR sitting alongside the current open one. When that happens, keep
 * whichever PR has the HIGHER PR number, not whichever the API returned last and not
 * whichever has the later `updated_at`: PR number is monotonically increasing and immune to
 * comment/label/CI activity bumping `updated_at` on a stale PR, so it is the only signal that
 * can't make a stale PR look like the current one. Picking the wrong PR here is a false
 * all-clear risk: a stale merged PR silently "verifying" a desk run whose real, current PR
 * never got checked.
 * @param {{name: string, sha: string}[]} branches
 * @param {{number: number, headRef: string, headSha: string, merged: boolean, updatedAt: string}[]} prs
 * @returns {{name: string, sha: string, committedAt: string|null, pr: {number:number, headSha:string, merged:boolean}|null}[]}
 */
export function mergeCandidates(branches, prs) {
  const byName = new Map()
  for (const b of branches || []) byName.set(b.name, { name: b.name, sha: b.sha, committedAt: null, pr: null })
  for (const p of prs || []) {
    const existing = byName.get(p.headRef)
    const pr = { number: p.number, headSha: p.headSha, merged: p.merged }
    if (existing) {
      // A PR already won this head ref — only replace it with a strictly newer PR number.
      if (existing.pr && existing.pr.number > pr.number) continue
      // Branch still exists: keep its independently-fetched sha (from `branches`) so the
      // PR-vs-branch sha comparison in evaluateDeskRun is a real cross-check, not an echo.
      existing.pr = pr
      existing.committedAt = p.updatedAt
    } else {
      // Branch already deleted (the normal post-merge state) — the PR is all that's left.
      byName.set(p.headRef, { name: p.headRef, sha: p.headSha, committedAt: p.updatedAt, pr })
    }
  }
  return [...byName.values()]
}

/**
 * Decide whether a desk's most recent run is verified, given independently-fetched GitHub state.
 * @param {BranchInfo | null} branch
 * @param {PrInfo | null} pr
 * @param {CheckInfo[]} checks
 * @returns {{ ok: boolean, status: string, reason: string, branch?: BranchInfo, pr?: PrInfo }}
 */
export function evaluateDeskRun(branch, pr, checks) {
  if (!branch) {
    return { ok: false, status: 'no-branch', reason: 'no branch matching the prefix exists on GitHub' }
  }
  if (!pr) {
    return {
      ok: false,
      status: 'no-pr',
      reason: `branch ${branch.name} exists but has no pull request — the run may have stopped before shipping`,
      branch,
    }
  }
  if (pr.headSha !== branch.sha) {
    return {
      ok: false,
      status: 'sha-mismatch',
      reason: `PR #${pr.number} head (${pr.headSha}) does not match branch HEAD (${branch.sha})`,
      branch,
      pr,
    }
  }
  if (pr.merged) {
    return { ok: true, status: 'merged', reason: `PR #${pr.number} merged`, branch, pr }
  }

  const failing = (checks || []).filter((c) => c.bucket === 'fail' || c.bucket === 'cancel')
  const pending = (checks || []).filter((c) => c.bucket === 'pending')
  const green = (checks || []).filter((c) => c.bucket === 'pass' || c.bucket === 'skipping')

  if (!checks || checks.length === 0) {
    return { ok: false, status: 'checks-pending', reason: `PR #${pr.number} has no checks reported yet`, branch, pr }
  }
  if (failing.length > 0) {
    return {
      ok: false,
      status: 'checks-red',
      reason: `PR #${pr.number} has failing checks: ${failing.map((c) => c.name).join(', ')}`,
      branch,
      pr,
    }
  }
  if (pending.length > 0) {
    return {
      ok: false,
      status: 'checks-pending',
      reason: `PR #${pr.number} still has checks running: ${pending.map((c) => c.name).join(', ')}`,
      branch,
      pr,
    }
  }
  if (green.length === checks.length) {
    return { ok: true, status: 'checks-green', reason: `PR #${pr.number} all checks green`, branch, pr }
  }
  return { ok: false, status: 'checks-red', reason: `PR #${pr.number} checks in an unrecognized state`, branch, pr }
}
