// Daily opportunity scan — Workflow #2's runner. Once a morning, per user, build a
// candidate set from patterns + affordability + top sweet spots, price it through
// the engine, keep only crossings (cpp >= 2.5; green >= 3.0 = "best find"), dedupe
// against state, and email the best one or two — or nothing.
//
// The agent follows skills/opportunity-alert.md. Phase 1 runs on balances + saved
// profile (live, reliable); pattern signal switches on in phase 2 once Gmail is
// verified. Every figure is the engine's; the schedule only wakes the agent.

import { defineSchedule } from 'eve/schedules'
import email from '../channels/email'

export default defineSchedule({
  name: 'daily-opportunity-scan',
  // 08:00 — a morning digest cadence (matches the design doc's `0 8 * * *`).
  cron: '0 8 * * *',
  async run({ receive, waitUntil }) {
    waitUntil(
      receive(email, {
        message:
          'Run the daily opportunity scan (skills/opportunity-alert.md): per user, load real ' +
          'balances (and patterns when available), build candidates from affordableWith + topValue ' +
          '(+ pattern routes in phase 2), price each through the engine, keep only cpp >= 2.5, ' +
          'dedupe against eve.lastOpportunities, and email the best 1-2. If nothing crosses, send nothing.',
      }),
    )
  },
})
