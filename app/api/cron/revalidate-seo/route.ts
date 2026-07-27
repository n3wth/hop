// GET /api/cron/revalidate-seo — weekly ISR refresh for SEO content surfaces.
//
// Revalidates the static guide indexes and legal/support pages so destination
// and sweet-spot trees pick up CONTENT_LAST_MODIFIED bumps without a full
// redeploy. Cheap on Vercel: no external API calls, just cache invalidation.
//
// AUTH: same CRON_SECRET bearer check as standing-orders. Gated by
// SEO_CRON_ENABLED (defaults on when unset) so local runs stay easy.

import { revalidatePath } from 'next/cache'
import { SEO_REVALIDATE_PATHS } from '@/lib/seo-routes'
import { recordHeartbeat } from '@/lib/cron-heartbeat'
import { isAuthorizedCron } from '@/lib/cron-auth'

export const dynamic = 'force-dynamic'

function isEnabled(): boolean {
  const raw = process.env.SEO_CRON_ENABLED
  if (raw === undefined || raw === '') return true
  return /^(1|true|yes)$/i.test(raw)
}

export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!isEnabled()) {
    // Liveness record (ADR 0007): being off is an owner choice, not an outage.
    recordHeartbeat('revalidate-seo', false, 'disabled')
    return Response.json({ status: 'disabled' }, { status: 503 })
  }

  const revalidated: string[] = []
  for (const path of SEO_REVALIDATE_PATHS) {
    revalidatePath(path)
    revalidated.push(path)
  }
  // Metadata routes — invalidate so lastModified / robots stay fresh.
  revalidatePath('/sitemap.xml')
  revalidatePath('/robots.txt')

  // Liveness record (ADR 0007): after the work — a fresh ok heartbeat means
  // "ran to completion". Fire-and-forget.
  recordHeartbeat('revalidate-seo', true, `revalidated:${revalidated.length + 2}`)

  return Response.json({ status: 'ok', revalidated, at: new Date().toISOString() })
}
