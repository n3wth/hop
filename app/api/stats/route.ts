// GET /api/stats — public trust/reliability snapshot (no auth). Makes the
// engine's "always resolves, never fabricates" invariant (docs/growth-hypothesis.md)
// visible outside the codebase: how many loyalty programs currently have
// live-verified pricing, out of how many hop knows, plus the last 24h of
// degraded-source counts. Every number comes from lib/trust-stats.ts, which
// reads existing lib/* aggregates and never throws — this route always
// answers 200 with real (possibly zeroed/null) numbers, never a fabricated one.

import { getTrustStats } from '@/lib/trust-stats'

// Reads live DB state on every request; never statically cache this route.
export const dynamic = 'force-dynamic'

export async function GET(): Promise<Response> {
  const stats = await getTrustStats()
  return Response.json(stats)
}
