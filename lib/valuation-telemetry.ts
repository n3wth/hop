// Fire-and-forget telemetry: reports live cash-vs-award cpp observations (already
// computed by lib/cpp.ts from real Duffel + seats.aero data) to the Cloudflare
// valuation Worker, which aggregates them into per-program overrides that
// lib/valuations-live.ts later merges over the static lib/valuations.ts baseline.
//
// GATED behind env.isValuationSyncEnabled() (HOP_ENABLE_VALUATION_SYNC + Worker
// URL + shared secret). Until all three are set this is a complete no-op — fetch
// is never called. recordCppObservations() itself is synchronous (void) and can
// NEVER throw or reject to the caller: the outbound POST is fired internally and
// every failure (network, timeout, non-2xx) is swallowed.

import { env, isValuationSyncEnabled } from '@/lib/env'

const TIMEOUT_MS = 3_000
const MAX_SAMPLES = 50

export interface CppObservation {
  programId: string
  cpp: number
  cashCents?: number
  miles?: number
}

function isValidSample(s: CppObservation): boolean {
  return (
    typeof s?.programId === 'string' &&
    s.programId.trim() !== '' &&
    typeof s.cpp === 'number' &&
    Number.isFinite(s.cpp) &&
    s.cpp > 0
  )
}

async function postObservations(samples: CppObservation[]): Promise<void> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    await fetch(`${env.hopValuationWorkerUrl()}/observe`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.hopValuationSyncSecret()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ samples }),
      signal: controller.signal,
    })
  } catch {
    // Network failure, timeout, non-2xx — telemetry must never affect the caller.
  } finally {
    clearTimeout(timer)
  }
}

// Report a batch of cpp observations. No-ops entirely when the sync seam is
// disabled. Filters to valid samples and caps to MAX_SAMPLES, then fires the
// POST without the caller awaiting it. Synchronous (returns void) — belt and
// suspenders: even a synchronous throw while kicking off the request can never
// escape to the caller.
export function recordCppObservations(samples: CppObservation[]): void {
  if (!isValuationSyncEnabled()) return
  if (!Array.isArray(samples) || samples.length === 0) return

  const valid = samples.filter(isValidSample).slice(0, MAX_SAMPLES)
  if (valid.length === 0) return

  try {
    void postObservations(valid)
  } catch {
    // Should be unreachable (postObservations only rejects, never throws
    // synchronously) but guarded anyway per the fire-and-forget contract.
  }
}
