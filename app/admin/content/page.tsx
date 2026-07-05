import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getOwnerSession } from '@/lib/owner'
import { listSweetSpotDrafts, draftableProgramOptions } from '@/lib/sweet-spot-drafts'
import ContentConsole from '@/components/admin/ContentConsole'

// Owner-only content review queue — the HITL step for agent-drafted sweet-spot
// copy (docs/superpowers/specs/2026-07-04-sweet-spot-content-review-design.md).
// Never cached, never indexed.
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Content',
  robots: { index: false, follow: false },
}

export default async function AdminContentPage() {
  // notFound (not 403) so the route doesn't even confirm it exists to non-owners.
  if (!(await getOwnerSession())) notFound()

  // null = the db read failed/unconfigured — the console renders "unavailable".
  const [drafts, programs] = await Promise.all([
    listSweetSpotDrafts(),
    draftableProgramOptions(),
  ])

  // Chrome (sidebar rail, account, nav) comes from app/admin/layout.tsx.
  return <ContentConsole drafts={drafts} programs={programs} />
}
