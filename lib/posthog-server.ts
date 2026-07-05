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
// PII BY CONSTRUCTION: by default distinct_id is a fixed server label and
// $process_person_profile is false, so no person profile is ever created —
// callers must still pass PII-free properties (no emails, no balances).
// FUNNEL EVENTS (R0.5) may pass opts.distinctId with the opaque Better Auth
// user.id so signed_up / first_program_added join the identified client-side
// funnel; that flips $process_person_profile on for the event. The id is the
// only identity ever sent — never an email or name.

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
  distinctId?: string,
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
        distinct_id: distinctId ?? 'hop-server',
        properties: { ...properties, $process_person_profile: distinctId != null },
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
// Returns a promise that ALWAYS resolves (postCapture swallows every failure
// and caps latency at TIMEOUT_MS) — most callers ignore it (fire-and-forget),
// but where delivery matters on serverless (the sign-up hook, the outclick
// shadow) await it or chain it into a promise handed to next/server's
// after(), or the function can freeze before the capture leaves the box.
export function captureServerEvent(
  event: string,
  properties: Record<string, unknown> = {},
  opts: { distinctId?: string } = {},
): Promise<void> {
  if (!isPostHogEnabled()) return Promise.resolve()
  if (typeof event !== 'string' || event.trim() === '') return Promise.resolve()
  try {
    const distinctId =
      typeof opts.distinctId === 'string' && opts.distinctId.trim() !== ''
        ? opts.distinctId.trim()
        : undefined
    return postCapture(event.trim(), properties, distinctId)
  } catch {
    // Should be unreachable (postCapture never throws synchronously and never
    // rejects) but guarded anyway per the fire-and-forget contract.
    return Promise.resolve()
  }
}
