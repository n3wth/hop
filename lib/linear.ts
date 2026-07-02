// Linear issue filing (ADR 0007) — the health sentinel's delivery channel.
// One GraphQL client, one job: create an issue from a rendered finding.
//
// GATED on LINEAR_API_KEY + LINEAR_TEAM_ID (isLinearConfigured — the filing
// sub-gate; detection needs no key). Discriminated {ok} result, NEVER throws:
// a dead Linear degrades filing to "findings stay open, P1s fall back to the
// owner email" (lib/improvement-findings.ts#fileFindings).
//
// DEDUPE: the findings table is the primary gate (filed_at re-read before
// every create). This client adds the secondary best-effort layer: a
// title-contains lookup on the `[hop:<fingerprint>]` marker before creating —
// if the query fails for any reason we just proceed, so the worst case stays
// "one rare visible duplicate", never a lost finding.
//
// The key is never logged (house lib/env.ts rule). Blast radius of the key:
// can create issues in one team.

import { env, hasEnv } from '@/lib/env'

const LINEAR_GRAPHQL_URL = 'https://api.linear.app/graphql'
const TIMEOUT_MS = 10_000
// Issues carry this label so the owner can filter or mute the whole channel.
const AUTO_FILED_LABEL = 'auto-filed'

export interface FileIssueInput {
  title: string
  body: string
  fingerprint: string
}

export type LinearResult =
  | { ok: true; issueId: string; identifier: string; alreadyExisted: boolean }
  | { ok: false; reason: 'unconfigured' | 'rate-limited' | 'send-failed' }

// The filing sub-gate: flag-on with no key is the DESIGNED detect-and-record
// mode (findings accumulate; the digest reports them; P1s go by email).
export function isLinearConfigured(): boolean {
  return hasEnv('LINEAR_API_KEY') && hasEnv('LINEAR_TEAM_ID')
}

type GqlData = Record<string, unknown>
type GqlResult = { ok: true; data: GqlData } | { ok: false; reason: 'rate-limited' | 'send-failed' }

// One guarded GraphQL POST. Never throws: network failure, timeout, non-2xx,
// and GraphQL-level errors all come back as {ok:false}.
async function gql(query: string, variables: Record<string, unknown>): Promise<GqlResult> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(LINEAR_GRAPHQL_URL, {
      method: 'POST',
      headers: {
        // Personal API keys go bare in the Authorization header (Linear's
        // convention — Bearer is for OAuth tokens).
        Authorization: env.linearApiKey(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, variables }),
      signal: controller.signal,
    })
    if (res.status === 429) return { ok: false, reason: 'rate-limited' }
    if (!res.ok) return { ok: false, reason: 'send-failed' }
    const json = (await res.json()) as { data?: GqlData; errors?: unknown[] }
    if (Array.isArray(json?.errors) && json.errors.length > 0) {
      return { ok: false, reason: 'send-failed' }
    }
    return { ok: true, data: json?.data ?? {} }
  } catch {
    return { ok: false, reason: 'send-failed' }
  } finally {
    clearTimeout(timer)
  }
}

const PREFLIGHT_QUERY = `
  query HopSentinelPreflight($dupFilter: IssueFilter, $labelFilter: IssueLabelFilter) {
    issues(filter: $dupFilter, first: 1) {
      nodes { id identifier }
    }
    issueLabels(filter: $labelFilter, first: 1) {
      nodes { id }
    }
  }
`

const LABEL_CREATE_MUTATION = `
  mutation HopSentinelLabelCreate($input: IssueLabelCreateInput!) {
    issueLabelCreate(input: $input) {
      success
      issueLabel { id }
    }
  }
`

const ISSUE_CREATE_MUTATION = `
  mutation HopSentinelIssueCreate($input: IssueCreateInput!) {
    issueCreate(input: $input) {
      success
      issue { id identifier }
    }
  }
`

interface IssueNode {
  id?: string
  identifier?: string
}

function firstNode(data: GqlData, key: string): Record<string, unknown> | null {
  const container = data[key]
  if (!container || typeof container !== 'object') return null
  const nodes = (container as { nodes?: unknown }).nodes
  if (!Array.isArray(nodes) || nodes.length === 0) return null
  const node = nodes[0]
  return node && typeof node === 'object' ? (node as Record<string, unknown>) : null
}

// File one issue. The `[hop:<fingerprint>]` marker is appended to the title —
// it is both the human-greppable identity and the dedupe key.
export async function fileIssue(input: FileIssueInput): Promise<LinearResult> {
  if (!isLinearConfigured()) return { ok: false, reason: 'unconfigured' }

  const marker = `[hop:${input.fingerprint}]`
  const title = `${input.title} ${marker}`

  // Secondary best-effort dedupe + label lookup in one round trip. Any
  // failure here is swallowed: the findings table is the primary gate, and a
  // missing label never blocks a filing.
  let labelId: string | undefined
  const preflight = await gql(PREFLIGHT_QUERY, {
    dupFilter: { title: { containsIgnoreCase: marker } },
    labelFilter: { name: { eqIgnoreCase: AUTO_FILED_LABEL } },
  })
  if (preflight.ok) {
    const dup = firstNode(preflight.data, 'issues') as IssueNode | null
    if (dup && typeof dup.id === 'string' && dup.id !== '') {
      return {
        ok: true,
        issueId: dup.id,
        identifier: typeof dup.identifier === 'string' ? dup.identifier : '',
        alreadyExisted: true,
      }
    }
    const label = firstNode(preflight.data, 'issueLabels')
    if (label && typeof label.id === 'string') labelId = label.id
  }

  // First-ever run: create the auto-filed label (best-effort; failure just
  // means this issue files unlabeled).
  if (preflight.ok && !labelId) {
    const created = await gql(LABEL_CREATE_MUTATION, {
      input: { teamId: env.linearTeamId(), name: AUTO_FILED_LABEL },
    })
    if (created.ok) {
      const payload = created.data.issueLabelCreate as
        | { success?: boolean; issueLabel?: { id?: string } }
        | undefined
      if (payload?.success && typeof payload.issueLabel?.id === 'string') {
        labelId = payload.issueLabel.id
      }
    }
  }

  const res = await gql(ISSUE_CREATE_MUTATION, {
    input: {
      teamId: env.linearTeamId(),
      title,
      description: input.body,
      ...(labelId ? { labelIds: [labelId] } : {}),
    },
  })
  if (!res.ok) return res
  const payload = res.data.issueCreate as
    | { success?: boolean; issue?: IssueNode }
    | undefined
  const issue = payload?.issue
  if (!payload?.success || !issue || typeof issue.id !== 'string' || issue.id === '') {
    return { ok: false, reason: 'send-failed' }
  }
  return {
    ok: true,
    issueId: issue.id,
    identifier: typeof issue.identifier === 'string' ? issue.identifier : '',
    alreadyExisted: false,
  }
}
