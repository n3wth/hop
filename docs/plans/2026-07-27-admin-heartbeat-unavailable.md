# Admin cron health: unavailable is not empty

## Problem

`listHeartbeats()` returns `null` when the monitoring read is unavailable and `[]` when the read
succeeds with no rows. The admin dashboard currently collapses both states into missing heartbeat
rows, so an unavailable read can label every cron `never run` when degradation telemetry still
loads.

## Plan

1. Render one explicit cron-health unavailable state when heartbeats are `null`, while keeping
   degradation telemetry visible independently.
2. Keep the existing monitoring-off explanation when self-improvement monitoring is disabled.
3. Preserve `[]` as the successful-empty state that renders each cron as `never run`.
4. Add a focused presentation test covering `null`, `[]`, and monitoring-off output.

## Verification

- Focused Vitest coverage for the system-health presentation.
- `npm run check`
- `npm run build`
- `/admin` screenshot attempt using the repository-supported local setup; report if owner auth
  prevents capture.
