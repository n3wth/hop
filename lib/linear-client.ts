// Read-only Linear client for the admin Team view's "Open items" section
// (app/admin/team/page.tsx). Deliberately narrow and separate from
// lib/linear.ts (the health sentinel's issue-FILING channel — mutations
// only): this file only ever queries, never creates or edits an issue.
//
// v1 scope: the three standing coordination-thread issues each desk mirrors
// its weekly memo to (docs/team/routines.md) — matched by exact title rather
// than a general "what's open" query, since those threads ARE the open-items
// surface today. GATED on LINEAR_API_KEY + LINEAR_TEAM_ID (same env keys
// lib/linear.ts uses). NEVER throws: missing config, network failure,
// timeout, and GraphQL errors all degrade to { ok: false }.

import { env } from '@/lib/env'
import { isLinearConfigured } from '@/lib/linear'

const LINEAR_GRAPHQL_URL = 'https://api.linear.app/graphql'
const TIMEOUT_MS = 8_000

export const STANDING_ISSUE_TITLES = [
  'Finance desk — approvals & budget',
  'Growth desk — drafts & approvals',
  'Strategy desk — weekly market & priority review',
] as const

export interface OpenItem {
  identifier: string
  title: string
  url: string
  updatedAt: string
  /** Most recent comment body, falling back to the issue description, or null if both are empty. */
  snippet: string | null
}

export type OpenItemsResult = { ok: true; items: OpenItem[] } | { ok: false }

const OPEN_ITEMS_QUERY = `
  query HopAdminOpenItems($filter: IssueFilter) {
    issues(filter: $filter, first: 10) {
      nodes {
        identifier
        title
        url
        updatedAt
        description
        comments(first: 25) {
          nodes {
            body
            createdAt
          }
        }
      }
    }
  }
`

interface RawComment {
  body?: unknown
  createdAt?: unknown
}

interface RawIssue {
  identifier?: unknown
  title?: unknown
  url?: unknown
  updatedAt?: unknown
  description?: unknown
  comments?: { nodes?: unknown }
}

function latestCommentBody(raw: RawIssue): string | null {
  const nodes = raw.comments?.nodes
  if (!Array.isArray(nodes) || nodes.length === 0) return null
  let latest: RawComment | null = null
  for (const node of nodes) {
    const comment = node as RawComment
    if (typeof comment.body !== 'string' || typeof comment.createdAt !== 'string') continue
    if (!latest || comment.createdAt > (latest.createdAt as string)) latest = comment
  }
  return typeof latest?.body === 'string' ? latest.body : null
}

function truncate(text: string, max = 240): string {
  const trimmed = text.trim()
  return trimmed.length > max ? `${trimmed.slice(0, max).trimEnd()}…` : trimmed
}

function parseIssue(raw: unknown): OpenItem | null {
  if (typeof raw !== 'object' || raw === null) return null
  const r = raw as RawIssue
  if (
    typeof r.identifier !== 'string' ||
    typeof r.title !== 'string' ||
    typeof r.url !== 'string' ||
    typeof r.updatedAt !== 'string'
  ) {
    return null
  }
  const snippetSource = latestCommentBody(r) ?? (typeof r.description === 'string' ? r.description : null)
  return {
    identifier: r.identifier,
    title: r.title,
    url: r.url,
    updatedAt: r.updatedAt,
    snippet: snippetSource ? truncate(snippetSource) : null,
  }
}

// One guarded GraphQL POST, matching lib/linear.ts's conventions. Never
// throws: network failure, timeout, non-2xx, and GraphQL-level errors all
// come back as { ok: false }.
export async function fetchOpenItems(): Promise<OpenItemsResult> {
  if (!isLinearConfigured()) return { ok: false }
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(LINEAR_GRAPHQL_URL, {
      method: 'POST',
      headers: {
        Authorization: env.linearApiKey(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: OPEN_ITEMS_QUERY,
        variables: {
          filter: {
            team: { id: { eq: env.linearTeamId() } },
            title: { in: STANDING_ISSUE_TITLES },
          },
        },
      }),
      signal: controller.signal,
    })
    if (!res.ok) return { ok: false }
    const json = (await res.json()) as { data?: { issues?: { nodes?: unknown } }; errors?: unknown[] }
    if (Array.isArray(json?.errors) && json.errors.length > 0) return { ok: false }
    const nodes = json?.data?.issues?.nodes
    if (!Array.isArray(nodes)) return { ok: false }
    const items = nodes.map(parseIssue).filter((item): item is OpenItem => item !== null)
    return { ok: true, items }
  } catch {
    return { ok: false }
  } finally {
    clearTimeout(timer)
  }
}
