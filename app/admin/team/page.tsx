import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getOwnerSession } from '@/lib/owner'
import { getTeamStatus, isGithubTeamSyncConfigured } from '@/lib/admin-team'
import { listMarketingDrafts } from '@/lib/admin-marketing'
import { fetchOpenItems } from '@/lib/linear-client'
import { isLinearConfigured } from '@/lib/linear'
import TeamPanel from '@/components/admin/TeamPanel'

// Owner-only view of hop's autonomous agent org (lib/team.ts's static
// roster): what each agent is currently doing (open PRs, filtered by branch
// prefix), what's waiting on the owner, the growth desk's drafts awaiting
// review, and the standing coordination threads' latest activity.
// GITHUB_TOKEN and LINEAR_API_KEY/LINEAR_TEAM_ID are optional — absent,
// every section still renders, just without that live data (none of the
// lib/* readers here throw).
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Team',
  robots: { index: false, follow: false },
}

export default async function AdminTeamPage() {
  // notFound (not 403) so the route doesn't confirm it exists to non-owners.
  if (!(await getOwnerSession())) notFound()

  const now = new Date()
  const [cards, drafts, openItemsResult] = await Promise.all([
    getTeamStatus(now),
    listMarketingDrafts(),
    fetchOpenItems(),
  ])

  return (
    <TeamPanel
      cards={cards}
      githubConfigured={isGithubTeamSyncConfigured()}
      now={now}
      drafts={drafts}
      openItems={openItemsResult.ok ? openItemsResult.items : null}
      linearConfigured={isLinearConfigured()}
    />
  )
}
