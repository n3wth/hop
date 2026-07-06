import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getOwnerSession } from '@/lib/owner'
import { getTeamStatus, isGithubTeamSyncConfigured } from '@/lib/admin-team'
import TeamPanel from '@/components/admin/TeamPanel'

// Owner-only view of hop's autonomous agent org (lib/team.ts's static
// roster): what each agent is currently doing (open PRs, filtered by branch
// prefix) and what's waiting on the owner. GITHUB_TOKEN is optional —
// absent, every card still renders, just without live PR data
// (lib/admin-team.ts never throws).
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Team',
  robots: { index: false, follow: false },
}

export default async function AdminTeamPage() {
  // notFound (not 403) so the route doesn't confirm it exists to non-owners.
  if (!(await getOwnerSession())) notFound()

  const now = new Date()
  const cards = await getTeamStatus(now)

  return <TeamPanel cards={cards} githubConfigured={isGithubTeamSyncConfigured()} now={now} />
}
