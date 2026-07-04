// GET /api/cron/business-digest — the weekly business digest (self-aware
// growth loop). Counts the week's funnel from hop's OWN tables
// (lib/business-digest.ts) and emails the owner a terse summary.
//
// GUARDING: requires the Vercel cron auth header (Authorization: Bearer
// CRON_SECRET) when the secret is set — same contract as the standing-orders
// cron. GATED on isEmailEnabled(): without RESEND_API_KEY there is nothing to
// deliver, so the route reports disabled and does no counting.
//
// NEVER 500s: every failure path is reported in the JSON body. A degraded
// table drops its section from the email (resolver returns null for it); if
// EVERY source degrades, nothing is sent and the body says why. Numbers are
// counted rows — no LLM anywhere.
//
// SCHEDULE: vercel.json — Mondays 14:07 UTC.

import { computeBusinessDigest, renderBusinessDigest } from '@/lib/business-digest'
import { isEmailEnabled, sendOwnerNotification } from '@/lib/email'
import { recordHeartbeat } from '@/lib/cron-heartbeat'
import { isAuthorizedCron } from '@/lib/cron-auth'

// Counts live per-request data; never cache or statically render.
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    if (!isAuthorizedCron(request)) {
      return Response.json({ ok: false, sent: false, reason: 'unauthorized' }, { status: 401 })
    }
    if (!isEmailEnabled()) {
      // Liveness record (ADR 0007): being unconfigured is an owner choice,
      // not an outage.
      recordHeartbeat('business-digest', false, 'disabled')
      return Response.json(
        { ok: false, sent: false, sections: [], reason: 'email-unconfigured' },
        { status: 503 },
      )
    }

    const digest = await computeBusinessDigest()
    const rendered = renderBusinessDigest(digest)
    if (!rendered) {
      // Every source degraded — there is nothing true to report, so we send
      // nothing. Still a successful run (200): the cron itself worked.
      recordHeartbeat('business-digest', true, 'all-sources-degraded')
      return Response.json({ ok: true, sent: false, sections: [], reason: 'all-sources-degraded' })
    }

    const result = await sendOwnerNotification(rendered.subject, rendered.text, rendered.html)
    // Liveness record (ADR 0007): after the work — ran to completion. No
    // heartbeat on the catch path below, deliberately: a crashing route must
    // go stale so D1 can see it.
    recordHeartbeat('business-digest', true, `sent:${result.ok} sections:${rendered.sections.length}`)
    return Response.json({
      ok: true,
      sent: result.ok,
      sections: rendered.sections,
      ...(result.ok ? {} : { reason: result.reason }),
    })
  } catch (e) {
    // Belt-and-braces: the resolver/formatter/sender all promise never to
    // throw, but the platform must still never see a 500 from this route.
    return Response.json({
      ok: false,
      sent: false,
      sections: [],
      reason: e instanceof Error ? e.message : 'error',
    })
  }
}
