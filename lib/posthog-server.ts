// Fire-and-forget server-side PostHog capture via plain fetch — no SDK dep.
// (The @posthog/ai OTel processor in instrumentation.ts only covers LLM spans;
// this is the seam for explicit server events like "search_degraded".)
//
// GATED on key presence (env.isPostHogEnabled: POSTHOG_KEY or
// NEXT_PUBLIC_POSTHOG_KEY, read lazily at call time) — absent, fetch is never
// called. captureServerEvent() is synchronous (void) and can NEVER throw or
// reject to the caller: the outbound POST is fired internally and every
// failure (network, timeout, non-2xx) is swallowed. Same contract as
// lib/valuation-telemetry.ts#recordCppObservations.
//
// Two capture flavors:
// - captureServerEvent — observability events. PII BY CONSTRUCTION:
//   distinct_id is a fixed server label and $process_person_profile is false,
//   so no person profile is ever created — callers must still pass PII-free
//   properties (no user ids, no balances).
// - captureFunnelEvent — the server half of the N-301 product funnel. With a
//   distinctId it DELIBERATELY keys the event to the Better Auth user id (the
//   same distinct_id lib/analytics-client.ts identifies with, so client and
//   server events join on one person); without one it falls back to the
//   anonymous server-label shape above (outclick — the ledger is anonymous by
//   design). Properties stay PII-free either way.

import type { FunnelEventName } from '@/lib/analytics'
import { env, hasEnv, isPostHogEnabled } from '@/lib/env'

const TIMEOUT_MS = 2_000
// Matches the instrumentation.ts default; override with POSTHOG_HOST /
// NEXT_PUBLIC_POSTHOG_HOST (no trailing slash).
const DEFAULT_HOST = 'https://us.i.posthog.com'

function resolveHost(): string {
  const host =
    hasEnv('POSTHOG_HOST') || hasEnv('NEXT_PUBLIC_POSTHOG_HOST')
      ? env.posthogHost()
      : DEFAULT_HOST
  return host.replace(/\/+$/, '')
}

async function postCapture(
  event: string,
  properties: Record<string, unknown>,
  distinctId: string,
): Promise<void> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    await fetch(`${resolveHost()}/capture/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: env.posthogKey(),
        event,
        distinct_id: distinctId,
        properties,
        timestamp: new Date().toISOString(),
      }),
      signal: controller.signal,
    })
  } catch {
    // Network failure, timeout, non-2xx — telemetry must never affect the caller.
  } finally {
    clearTimeout(timer)
  }
}

// Capture one server-side event. No-ops entirely without a PostHog key.
// Synchronous (returns void) — belt and suspenders: even a synchronous throw
// while kicking off the request can never escape to the caller.
export function captureServerEvent(
  event: string,
  properties: Record<string, unknown> = {},
): void {
  if (!isPostHogEnabled()) return
  if (typeof event !== 'string' || event.trim() === '') return
  try {
    void postCapture(event.trim(), { ...properties, $process_person_profile: false }, 'hop-server')
  } catch {
    // Should be unreachable (postCapture only rejects, never throws
    // synchronously) but guarded anyway per the fire-and-forget contract.
  }
}

// Server half of the N-301 funnel (signed_up, first_program_added, outclick).
// distinctId present → a person event keyed to the Better Auth user id, so it
// joins the person lib/analytics-client.ts identify()s on the client.
// distinctId absent → the anonymous server-label shape (outclick mirrors the
// anonymous hop_outclicks ledger). Gated on the same key as everything else;
// the returned promise ALWAYS resolves (never rejects, never throws
// synchronously) so callers can await it or hand it to next/server's after()
// to keep a serverless function alive until the capture settles.
export function captureFunnelEvent(opts: {
  event: FunnelEventName
  distinctId?: string
  properties?: Record<string, unknown>
}): Promise<void> {
  if (!isPostHogEnabled()) return Promise.resolve()
  try {
    const distinctId = opts.distinctId?.trim()
    if (distinctId) return postCapture(opts.event, { ...opts.properties }, distinctId)
    return postCapture(
      opts.event,
      { ...opts.properties, $process_person_profile: false },
      'hop-server',
    )
  } catch {
    // Same fire-and-forget contract as captureServerEvent.
    return Promise.resolve()
  }
}
