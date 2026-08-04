// Live data layer for the admin Team view (app/admin/team/page.tsx). Composes
// lib/team.ts's static roster with:
//   - GitHub: each agent's open PRs, filtered by branch prefix. GATED on
//     GITHUB_TOKEN — absent, every card still renders, just without PR data
//     (the house graceful-degradation rule: never throw to the page).
//   - "Waiting on Oliver": per-member, derived from the PR data plus a
//     couple of static deep links (Linear views that don't exist yet get a
//     link to the hop project rather than a guessed URL that would 404).
//   - Next scheduled run: a pure cron-to-Date calculator, degradation-free
//     (no I/O), covered by lib/__tests__/admin-team.test.ts.
//
// One GitHub REST call for the whole repo's open PRs — filtered client-side
// per member, not N+1 per member. Checks/CI state is deliberately left out
// of v1: the PR-list endpoint doesn't carry it, and fetching per-PR
// check-runs would be N+1 calls against a rate-limited API for a "nice to
// have" column.

import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { hasEnv, env } from '@/lib/env'
import { TEAM, type TeamMember } from '@/lib/team'

const GITHUB_API = 'https://api.github.com'
const GITHUB_REPO = 'n3wth/hop'
const TIMEOUT_MS = 8_000

// The hop project's Linear board — the same deep link AgentActivity.tsx
// already uses. Omar's and Elizabeth's dedicated approval views don't exist
// yet, so this is the honest destination until they're created.
const LINEAR_HOP_PROJECT_URL = 'https://linear.app/newth/project/hop-9365da373b9a'

export interface TeamPullRequest {
  number: number
  title: string
  url: string
  draft: boolean
  headRef: string
  updatedAt: string
}

export interface WaitingOnItem {
  label: string
  href?: string
}

export interface TeamCard {
  member: TeamMember
  nextRunAt: Date
  /** This member's open PRs, or null when GitHub sync is unavailable. */
  work: TeamPullRequest[] | null
  waitingOn: WaitingOnItem[]
}

export function isGithubTeamSyncConfigured(): boolean {
  return hasEnv('GITHUB_TOKEN')
}

type PrListResult = { ok: true; prs: TeamPullRequest[] } | { ok: false }

// One guarded GET for every open PR in the repo. NEVER throws: missing
// token, network failure, timeout, and non-2xx all come back as {ok:false}.
async function fetchOpenPullRequests(): Promise<PrListResult> {
  if (!isGithubTeamSyncConfigured()) return { ok: false }
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(`${GITHUB_API}/repos/${GITHUB_REPO}/pulls?state=open&per_page=100`, {
      headers: {
        Authorization: `Bearer ${env.githubToken()}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      signal: controller.signal,
    })
    if (!res.ok) return { ok: false }
    const data: unknown = await res.json()
    if (!Array.isArray(data)) return { ok: false }
    const prs = data.map(parsePr).filter((pr): pr is TeamPullRequest => pr !== null)
    return { ok: true, prs }
  } catch {
    return { ok: false }
  } finally {
    clearTimeout(timer)
  }
}

function parsePr(raw: unknown): TeamPullRequest | null {
  if (typeof raw !== 'object' || raw === null) return null
  const r = raw as Record<string, unknown>
  const head = r.head as Record<string, unknown> | undefined
  const headRef = head?.ref
  if (
    typeof r.number !== 'number' ||
    typeof r.title !== 'string' ||
    typeof r.html_url !== 'string' ||
    typeof headRef !== 'string' ||
    typeof r.updated_at !== 'string'
  ) {
    return null
  }
  return {
    number: r.number,
    title: r.title,
    url: r.html_url,
    draft: r.draft === true,
    headRef,
    updatedAt: r.updated_at,
  }
}

// Elizabeth's AgentMail inbox address is recorded here by hand the first
// time she runs (docs/finance/README.md). Missing file / no address found
// both degrade to null — the card falls back to "hasn't run yet" copy
// instead of a mailto link to nowhere.
async function readElizabethInboxEmail(): Promise<string | null> {
  try {
    const text = await readFile(path.join(process.cwd(), 'docs/finance/README.md'), 'utf8')
    const match = text.match(/[\w.+-]+@[\w-]+\.[\w.-]+/)
    return match ? match[0] : null
  } catch {
    return null
  }
}

function draftAwaitingReview(prs: TeamPullRequest[] | null): WaitingOnItem[] {
  if (prs === null) return []
  const drafts = prs.filter((pr) => pr.draft)
  if (drafts.length === 0) return []
  return [{ label: `${drafts.length} draft PR${drafts.length === 1 ? '' : 's'} awaiting review` }]
}

async function waitingOnFor(member: TeamMember, prs: TeamPullRequest[] | null): Promise<WaitingOnItem[]> {
  switch (member.slug) {
    case 'omar':
      return [{ label: 'Growth drafts awaiting approval', href: LINEAR_HOP_PROJECT_URL }]
    case 'elizabeth': {
      const email = await readElizabethInboxEmail()
      const memo: WaitingOnItem = email
        ? { label: 'Replies to her latest memo', href: `mailto:${email}` }
        : { label: "Hasn't run yet." }
      return [memo, { label: 'Finance desk — approvals & budget', href: LINEAR_HOP_PROJECT_URL }]
    }
    default:
      return draftAwaitingReview(prs)
  }
}

// Cron → next UTC run time. Deliberately narrow: the registry only ever uses
// a fixed minute + hour, `*` day-of-month/month, and dow as either `*` or a
// comma-list of ints — this is NOT a general cron parser, and unsupported
// syntax will silently misbehave rather than throw. Pure (no Date.now()) so
// it's fully deterministic under test.
export function nextCronRun(cron: string, from: Date): Date {
  const fields = cron.trim().split(/\s+/)
  const minute = Number(fields[0])
  const hour = Number(fields[1])
  const dowField = fields[4] ?? '*'
  const allowedDays = dowField === '*' ? null : dowField.split(',').map(Number)

  const candidate = new Date(
    Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate(), hour, minute, 0, 0)
  )
  if (candidate.getTime() <= from.getTime()) {
    candidate.setUTCDate(candidate.getUTCDate() + 1)
  }
  if (allowedDays !== null) {
    while (!allowedDays.includes(candidate.getUTCDay())) {
      candidate.setUTCDate(candidate.getUTCDate() + 1)
    }
  }
  return candidate
}

// "in 3h" / "in 2d" — coarse enough that render-time drift between the
// server computing this and the browser painting it never looks wrong.
export function formatNextRun(target: Date, from: Date): string {
  const diffMs = target.getTime() - from.getTime()
  if (diffMs <= 0) return 'due now'
  const diffMin = Math.round(diffMs / 60_000)
  if (diffMin < 60) return `in ${diffMin}m`
  const diffHr = Math.round(diffMin / 60)
  if (diffHr < 48) return `in ${diffHr}h`
  return `in ${Math.round(diffHr / 24)}d`
}

// The single composed read for /admin/team. Never throws: a dead GitHub
// call degrades every card's `work` to null, never the whole page.
export async function getTeamStatus(now: Date = new Date()): Promise<TeamCard[]> {
  const prResult = await fetchOpenPullRequests()
  return Promise.all(
    TEAM.map(async (member) => {
      const work = prResult.ok
        ? prResult.prs.filter((pr) => pr.headRef.startsWith(member.branchPrefix))
        : null
      return {
        member,
        nextRunAt: nextCronRun(member.cron, now),
        work,
        waitingOn: await waitingOnFor(member, work),
      }
    })
  )
}
