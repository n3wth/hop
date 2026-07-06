#!/usr/bin/env node
// Deterministic, non-agentic verification that an autonomous desk's most recent run actually
// landed on GitHub — as opposed to an LLM session narrating success while its push, PR, or
// CI silently failed. Meant to replace a branch-recency-only check: a branch existing and
// being recent does NOT mean the desk shipped (see the "no-pr" and "sha-mismatch" outcomes
// below), so it is a necessary but insufficient signal on its own.
//
// Usage: node scripts/verify-desk-run.mjs <branch-prefix> [--repo owner/repo]
//        npm run verify:desk -- <branch-prefix>
// Exit 0 = verified (merged, or open with all-green checks). Exit 1 = anything else,
// including "can't tell" (fail-closed, matching .claude/workflows/review-parallel.js).
//
// Wiring note for the Hermes org-liveness watchdog on the mini (docs/agent-playbook.md
// "Reliability practices" / docs/ops-runbook.md): `hop-org-liveness-watchdog` currently checks
// branch recency only. It should shell out to this script per desk prefix
// (autopilot/, growth/, retro/, finance/) instead, and alert Oliver on a non-zero exit the
// same way it alerts on silence today. This script only builds the repo-side primitive; the
// mini's crontab/watchdog config is not reachable from this repo and must be updated separately.

import { execFileSync } from 'node:child_process'
import { evaluateDeskRun, pickLatestBranch } from './verify-desk-logic.mjs'

function parseArgs(argv) {
  const args = { repo: 'n3wth/hop', prefix: null }
  const rest = [...argv]
  args.prefix = rest.shift() || null
  while (rest.length) {
    const flag = rest.shift()
    if (flag === '--repo') args.repo = rest.shift()
    else throw new Error(`unrecognized argument: ${flag}`)
  }
  return args
}

function gh(args) {
  return execFileSync('gh', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
}

function ghJson(args) {
  return JSON.parse(gh(args))
}

// `-q` prints one JSON object per line (not a JSON array), including for a single page —
// parse line-by-line rather than via ghJson's single JSON.parse.
function ghJsonLines(args) {
  return String(gh(args))
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line))
}

// A self-merging desk's PR is created with `--delete-branch` (docs/agent-playbook.md §1), so
// after a healthy merge the branch itself is GONE — the PR is the only surviving record. If
// this only looked at `repos/{repo}/branches`, a desk that shipped perfectly would read as
// "no-branch" (verified live: `growth/` returned no-branch right after its last PR merged).
// So the PR list is the primary source, matched by head ref; the live `branches` list is
// consulted too, purely to get an independently-fetched SHA to sanity-check the PR's `head.sha`
// against when the branch still exists (still-open desk, or a merge that kept the branch).
function fetchCandidates(repo, prefix) {
  const branches = ghJsonLines(['api', `repos/${repo}/branches`, '--paginate', '-q', '.[] | {name, sha: .commit.sha}']).filter(
    (b) => b.name.startsWith(prefix),
  )
  const prs = ghJsonLines([
    'api',
    `repos/${repo}/pulls?state=all&per_page=100`,
    '--paginate',
    '-q',
    '.[] | {number, headRef: .head.ref, headSha: .head.sha, merged: (.merged_at != null), updatedAt: .updated_at}',
  ]).filter((p) => p.headRef.startsWith(prefix))

  const byName = new Map()
  for (const b of branches) byName.set(b.name, { name: b.name, sha: b.sha, committedAt: null, pr: null })
  for (const p of prs) {
    const existing = byName.get(p.headRef)
    const pr = { number: p.number, headSha: p.headSha, merged: p.merged }
    if (existing) {
      // Branch still exists: keep its independently-fetched sha (from `branches`) so the
      // PR-vs-branch sha comparison in evaluateDeskRun is a real cross-check, not an echo.
      existing.pr = pr
      existing.committedAt = p.updatedAt
    } else {
      // Branch already deleted (the normal post-merge state) — the PR is all that's left.
      byName.set(p.headRef, { name: p.headRef, sha: p.headSha, committedAt: p.updatedAt, pr })
    }
  }
  for (const candidate of byName.values()) {
    if (candidate.committedAt) continue
    const commit = ghJson(['api', `repos/${repo}/commits/${candidate.sha}`, '-q', '{date: .commit.committer.date}'])
    candidate.committedAt = commit.date
  }
  return [...byName.values()]
}

function fetchChecks(repo, prNumber) {
  if (!prNumber) return []
  try {
    return ghJson(['pr', 'checks', String(prNumber), '--repo', repo, '--json', 'name,bucket'])
  } catch (err) {
    // `gh pr checks` exits non-zero when checks are pending or failing — that's still valid
    // JSON on stdout, so re-parse it rather than treating a non-zero exit as "no data".
    if (err.stdout) {
      try {
        return JSON.parse(err.stdout)
      } catch {
        return []
      }
    }
    return []
  }
}

function main() {
  const { repo, prefix } = parseArgs(process.argv.slice(2))
  if (!prefix) {
    console.error('usage: node scripts/verify-desk-run.mjs <branch-prefix> [--repo owner/repo]')
    process.exit(2)
  }

  execFileSync('gh', ['auth', 'status'], { stdio: 'ignore' })

  const latest = pickLatestBranch(fetchCandidates(repo, prefix))
  const branch = latest ? { name: latest.name, sha: latest.sha, committedAt: latest.committedAt } : null
  const pr = latest ? latest.pr : null
  const checks = pr && !pr.merged ? fetchChecks(repo, pr.number) : []

  const result = evaluateDeskRun(branch, pr, checks)

  console.log(JSON.stringify({ repo, prefix, ...result }, null, 2))
  process.exit(result.ok ? 0 : 1)
}

main()
