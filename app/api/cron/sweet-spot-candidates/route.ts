// GET /api/cron/sweet-spot-candidates — mines assembleSearch over a curated
// hub/destination/date grid (lib/sweet-spot-candidates.ts) for notable
// Business-cabin award redemptions and drops them into the existing owner
// review queue (hop_sweet_spot_drafts) as pending_review — never approved.
//
// GATING: runs ONLY when isContentCandidatesEnabled() is true (the explicit
// flag AND the two live pricing keys /search already needs). Until then the
// route returns 503 and does NO work. Also requires the Vercel cron auth
// header (CRON_SECRET) when set — mirrors valuation-sync/route.ts exactly.
//
// SCHEDULE: wired in vercel.json.
//
// NEVER 500s: every function this calls (assembleSearch, the sweet-spot-draft
// persistence helpers) is documented never-throw and degrades to an empty/no-op
// result on upstream failure, so an unavailable pricing source just means
// "found 0 today", not an alarm.

import { revalidatePath } from 'next/cache'
import { isContentCandidatesEnabled } from '@/lib/env'
import { findSweetSpotCandidates, createCandidateDrafts } from '@/lib/sweet-spot-candidates'
import { recordHeartbeat } from '@/lib/cron-heartbeat'
import { isAuthorizedCron } from '@/lib/cron-auth'

// This route reads live remote pricing and must never be cached or statically rendered.
export const dynamic = 'force-dynamic'

function isEnabled(): boolean {
  return isContentCandidatesEnabled()
}

export async function GET(request: Request) {
  if (!isEnabled()) {
    // Liveness record (ADR 0007): being off is an owner choice, not an outage.
    if (isAuthorizedCron(request)) recordHeartbeat('sweet-spot-candidates', false, 'disabled')
    return Response.json({ ok: false, error: 'disabled' }, { status: 503 })
  }
  if (!isAuthorizedCron(request)) {
    return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  const candidates = await findSweetSpotCandidates()
  const { created } = await createCandidateDrafts(candidates)
  const skipped = candidates.length - created

  if (created > 0) revalidatePath('/admin/content')

  recordHeartbeat('sweet-spot-candidates', true, `created:${created} skipped:${skipped}`)
  return Response.json({ ok: true, created, skipped })
}
