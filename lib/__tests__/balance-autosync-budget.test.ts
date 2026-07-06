// Regression test for the #207 review finding: MAX_PER_RUN * FETCH_TIMEOUT_MS
// (rows sync sequentially) must stay safely inside the cron route's
// maxDuration, or a full batch of slow logins can get killed mid-run by the
// platform before per-row status is recorded.

import { describe, it, expect } from 'vitest'
import { MAX_PER_RUN, FETCH_TIMEOUT_MS } from '@/lib/balance-autosync'
import { maxDuration } from '@/app/api/cron/balance-autosync/route'

describe('balance-autosync run budget', () => {
  it('keeps the worst-case sequential run comfortably inside the cron maxDuration', () => {
    const worstCaseMs = MAX_PER_RUN * FETCH_TIMEOUT_MS
    const budgetMs = maxDuration * 1000
    expect(worstCaseMs).toBeLessThan(budgetMs)
    // Leave headroom for extraction + DB writes on top of the raw fetches,
    // not just enough to squeak under the wire.
    expect(budgetMs - worstCaseMs).toBeGreaterThanOrEqual(30_000)
  })
})
